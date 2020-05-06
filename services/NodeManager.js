import oncePerServices from './oncePerServices'
import prettyPrint from '../utils/prettyPrint'
import defineProps from '../utils/defineProps'
import missingService from './missingService'
import {
  READY,
  FAILED,
  STOPPED,
  WAITING_FAILED_TO_START_SERVICE
} from './Service.states'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const schema = require('./NodeManager.schema');

const REPORT_HEALTH_INTERVAL = 30000;

export default oncePerServices(function (services) {

  const {bus = missingService('bus')} = services;

  class NodeManager {
    _serviceCountToStartNode = 0;
    _serviceStarted = 0;
    _startedPromise = new Promise((resolve, reject) => {
      this._startedResolve = resolve;
    });

    constructor(options) {
      schema.ctor_options(this, options);

      this._context = options.context;

      if (Array.isArray(options.startOnly) && options.startOnly.length > 0) {
        this._startOnly = options.startOnly.reduce((a, v) => { a[v] = true; return a; }, Object.create(null));
      }

      // выдаем событие nodemanager.started, когда все зарегистрированные сервисы
      const startTime = Date.now();
      const startedServices = Object.create(null);
      const listener = (ev) => {
        if (ev.state === READY || ev.state === FAILED || ev.state === WAITING_FAILED_TO_START_SERVICE) {
          if (!hasOwnProperty.call(startedServices, ev.service)) { // этот сервис ещё не проходил через READY, FAILED или WAITING_FAILED_TO_START_SERVICE
            startedServices[ev.service] = true;
            if (++this._serviceStarted === this._serviceCountToStartNode) { // все зарегестрированные сервисы прошли через состояние READY или FAILED
              try {
                bus.removeListener('service.state', listener); // перестаем слушать изменения состояний
                const failedServices = [];
                for (const serviceName in this._services) {
                  const service = this._services[serviceName];
                  if (!(typeof service === 'object' && hasOwnProperty.call(service, '_service'))) continue; // это базовый сервис - console, bus, manager, testMode
                  const state = service._service.get('state');
                  if (state === FAILED || state === WAITING_FAILED_TO_START_SERVICE) failedServices.push(serviceName);
                }
                const ev = {
                  context: this._context,
                  type: 'nodemanager.started',
                  service: 'nodeManager',
                  startDuration: Date.now() - startTime,
                };
                if (failedServices.length > 0) ev.failedServices = failedServices;
                bus.info(ev);
                this._startedResolve();
                this.reportHealth();
              } catch (err) {
                console.error(err);
              }
            }
          }
        }
      };
      bus.on('service.state', listener);

      Object.assign(this._services = Object.create(null), services);
      this._services.manager = this;
      if (options.services) {
        this.add(options.services);
      }
    }

    /**
     * Добавляет сервисы в менеджер.  Сервисы добавляются в том порядке, в котором они переданны в метод.
     */
    add(newServices) {
      const services = this._services;
      newServices = Array.isArray(newServices) ? newServices : arguments;
      // Шаг 1: Вызываем у всех новых сервисов метод config, если он определен, для того чтобы сервисы могли зарегестрировать события
      for (const svc of newServices) {
        if (!(hasOwnProperty.call(svc, 'name') && typeof svc.name === 'string')) throw new Error(`Invalid argument 'service': ${prettyPrint(svc)}`);
      }
      // Шаг 2: Создаем инстансы новых сервисов.  С этого момента сервис может стартовать
      for (const svc of newServices) {
        if (hasOwnProperty.call(services, svc.name)) throw new Error(`Duplicated service name: '${svc.name}'`);
        const service = services[svc.name] = svc.default(services);
      }
    }

    _startServices() {
      const services = this._services;
      for (const serviceName in this._services) {
        const service = this._services[serviceName];
        if (!service._service) continue; // пропускаем manager, bus, console
        if (service._service._stop) {
          if (!this._startOnly) {
            const ev = {
              context: this._context,
              type: 'service.state',
              service: service._service._name,
              state: service._service._state,
              prevState: STOPPED,
              reasonMessage: `service has "stop" set to true in config`
            };
            if (service._service._serviceType) ev.serviceType = service._service._serviceType;
            bus.event(ev);
          } else {
            // это нужно только когда указан this._startOnly.  Иначе сервис стартует сразу, как его создали - см. код Service.js
            // нельзя использовать _service.start(), так как он переводит _stop в false
            service._service._nextStateStep();
          }
        } else {
          const d = dependsOnStoppedServices(services, service._service.dependsOn);
          if (d) {
            if (!this._startOnly) {
              const ev = {
                context: this._context,
                type: 'service.state',
                service: service._service._name,
                state: service._service._state,
                prevState: STOPPED,
                reasonMessage: `service will not start, cause it depends on service with "stop" set to true: ${d.join(', ')}`,
              };
              if (service._service._serviceType) ev.serviceType = service._service._serviceType;
              bus.event(ev);
            }
          }
          else {
            if (this._startOnly) {
              service._service._nextStateStep(); // это нужно только когда указан this._startOnly.  Иначе сервис стартует сразу, как его создали - см. код Service.js
            }
            this._serviceCountToStartNode++;
          }
        }
      }
    }

    reportHealth() {
      setTimeout(() => this.reportHealth(), REPORT_HEALTH_INTERVAL);
      const ev = Object.create(null);
      ev.context = this._context;
      ev.type = 'nodemanager.health';
      ev.service = 'nodeManager';
      for (let serviceName in this._services) {
        const s = this._services[serviceName];
        // далем замену симвоволов в имене сервиса, так как иначе эти поля игнорирует graylog
        if (hasOwnProperty.call(s, '_service')) ev [`svc_${serviceName.replace('/', '_')}`] = s._service._state === READY ? 1 : 0;
      }
      bus.event(ev);
    }

    async dispose() {
      const services = this._services;
      const lst = [];
      for (const serviceName in services) {
        const svc = services[serviceName];
        if (typeof svc !== 'object' || !hasOwnProperty.call(svc, '_service')) continue; // пропускаем базовые серисы (console, bus, manager) и флаг 'testMode'
        lst.push(svc._service.dispose());
      }
      await new Promise(function (resolve, reject) {
        if (lst.length === 0) resolve();
        else Promise.all(lst).then(() => {
          resolve();
        }); // все dispose всегда возвращаются успешно
        // TODO: Подумать, нужно ли добавить timeout для этой операции
        // TODO: Нужно ли выводить в bus сообытие что работа завершена
      });
      await bus.dispose();
    }
  }

  defineProps(NodeManager, {
    context: {
      get() {
        return bus._context;
      }
    },
    name: {
      get() {
        return bus.node;
      }
    },
    services: {
      get() {
        return this._services;
      }
    },
    started: {
      /**
       * Возвращает Promise, который переходит в fulfilled состояние, после событие NodeManager started.
       * @returns {Promise}
       */
      get() {
        if (this._startOnly) {
          leaveOnlyRequiredServices(this._services, this._startOnly);
        }
        this._startServices();
        return this._startedPromise;
      }
    },
  });

  return NodeManager;

  function dependsOnStoppedServices(services, dependsOn) {
    let r;
    if (dependsOn) {
      for (const svcName of Object.keys(dependsOn)) {
        const svc = services[svcName]._service;
        if (svc._stop) {
          (r || (r = [])).push(svcName);
        } else {
          const v = dependsOnStoppedServices(services, svc.dependsOn);
          if (v) {
            if (r) r = Array.prototype.push.apply(r, v);
            else r = v;
          }
        }
      }
    }
    return r;
  }

  /**
   * Ставим признак stop на все сервисы, кроме тех, которые перечислены в startOnly и сервисы от которых зависят сервисы в startOnly.
   */
  function leaveOnlyRequiredServices(services, startOnly) {
    const map = Object.create(null);
    addDependsOn(map, services, startOnly);
    Object.values(services).forEach(svc => {
      if (svc._service && !map[svc._service.name]) {
        svc._service._stop = true;
      }
    });
  }

  function addDependsOn(map, services, dependsOn) {
    for (const svcName in dependsOn) {
      const svc = services[svcName];
      if (!svc) {
        // throw new Error(`Missing service '${svcName}'`);
        continue; // zork: вместо ошибки, просто пропускаем сервис который есть в config/startOnly.js, но при этом не добавлен в NodeManager
      }
      map[svcName] = true;
      const dependsOn = svc._service.dependsOn;
      if (dependsOn) {
        addDependsOn(map, services, dependsOn);
      }
    }
  }
});
