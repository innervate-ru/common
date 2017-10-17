import oncePerServices from './oncePerServices'
import prettyPrint from '../utils/prettyPrint'
import defineProps from '../utils/defineProps'
import missingService from './missingService'
import {READY, FAILED} from './Service.states'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const schema = require('./NodeManager.schema');

export default oncePerServices(function (services) {

  const {bus = missingService('bus')} = services;

  class NodeManager {

    _serviceCount = 0;
    _serviceStarted = 0;
    _startedPromise = new Promise((resolve, reject) => {
      this._startedResolve = resolve;
    });

    constructor(options) {
      schema.ctor_options(this, options);

      // выдаем событие nodemanager.started, когда все зарегистрированные сервисы
      const startTime = Date.now();
      const startedServices = Object.create(null);
      const listener = (ev) => {
        if (ev.state === READY || ev.state == FAILED) {
          if (!hasOwnProperty.call(startedServices, ev.source)) { // этот сервис ещё не проходил через READY или FAILED
            startedServices[ev.source] = true;
            if (++this._serviceStarted === this._serviceCount) { // все зарегестрированные сервисы прошли через состояние READY или FAILED
              try {
                bus.removeListener('service.state', listener); // перестаем слушать изменения состояний
                const failedServices = [];
                for (const serviceName in this._services) {
                  const service = this._services[serviceName];
                  if (!(typeof service === 'object' && hasOwnProperty.call(service, '_service'))) continue; // это базовый сервис - console, bus, manager, testMode
                  const state = service._service.get('state');
                  if (state === FAILED) failedServices.push(serviceName);
                }
                const ev = {
                  type: 'nodemanager.started',
                  source: this._name,
                  startDuration: Date.now() - startTime,
                };
                if (failedServices.length > 0) ev.failedServices = failedServices;
                bus.info(ev);
                this._startedResolve();
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
      if (options.services) this.add(options.services);
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
        if (hasOwnProperty.call(services, svc.name)) throw new Error(`Duplicated service name: '${svc.name}'`);

        // Zork: После того как схемы event'ов были перемещены в .events.js, стало не понятно что именно надо делать в
        // config.  Поэтому отключаем эту возможность, пока не станет понятно зачем это надо

        // if (svc.config !== undefined) {
        //   if (!(typeof svc.config === 'function')) throw new Error(`Service '${svc.name}': Prop 'config' must be a function`);
        //   svc.config(services);
        // }

      }
      // Шаг 2: Создаем инстансы новых сервисов.  С этого момента сервис может стартовать
      for (const svc of newServices) {
        services[svc.name] = svc.default(services);
        this._serviceCount++;
      }
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
          resolve(); }); // все dispose всегда возвращаются успешно
        // TODO: Подумать, нужно ли добавить timeout для этой операции
        // TODO: Нужно ли выводить в bus сообытие что работа завершена
      });
      await bus.dispose();
    }
  }

  defineProps(NodeManager, {
    name: {
      get() {
        return this._name;
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
        return this._startedPromise;
      }
    },
  });

  return NodeManager;

});
