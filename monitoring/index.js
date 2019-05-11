import configAPI from 'config'
import oncePerServices from '../services/oncePerServices'
import defineProps from '../utils/defineProps'
import {READY, FAILED} from "../services/Service.states";
import {missingArgument} from '../validation/index'
import {missingService} from '../services/index'

const hasOwnProperty = Object.prototype.hasOwnProperty;

// export const name = require('../services/serviceName').default(__filename);
export const name = 'monitoring'; // так как сервис в common, то имя задаем явно

const schema = require('./index.schema');

const counterBuilders = {
  times: require('./_counterTimes').default,
  avg: require('./_counterAvg').default,
  max: require('./_counterMax').default,
  avgPerMinue: require('./_counterAvgPerMinute').default,
};

let _isRunning = false;
const _svcList = [];
let _svcCounters = Object.create(null);
let _prevSvcCounters = Object.create(null);

let _svc = _prevSvc = Object.create(null);
let _svcFail = _prevSvcFail = Object.create(null);

// в первый период текущие счетчики, равны счетчикам за предыдущий период.  Функциональные счётчики остаются в своем начальном значении
let _prevSvc = _svc;
let _prevSvcFail = _svcFail;

export default oncePerServices(function (services) {

  class Monitoring {

    constructor(options) {
      schema.ctor_options(this, options);
      this._countersResetPeriod = options.countersResetPeriod;
    }

    async _serviceInit() {
      setInterval(() => {
        try {
          this._resetCounters();
        } catch (err) {
          this._service._reportError(err);
        }
      }, this._countersResetPeriod);
    }

    _resetCounters() {
      const prevSvc = _prevSvc;
      _prevSvc = _svc;
      _prevSvcFail = _svcFail;
      _svc = Object.create(null);
      _svcFail = Object.create(null);
      _svcList.forEach((s) => {
        _svc[s] = prevSvc[s];
        _svcFail[s] = 0;
      });
      Object.values(_svcCounters).forEach(s => {
        s.forEach(c => {
          _prevSvcCounters[c.counterName] = c.getAndReset();
        });
      });
    }

    async reportCounters() {
      const res = [];
      _svcList.forEach(n => {
        const fixedName = n.replace(/\//g, '_');
        res.push(`${fixedName}_is_ready ${_prevSvc[n]}`);
        res.push(`${fixedName}_failed_times ${_prevSvcFail[n]}`);
        if (_svcCounters[n]) {
          _svcCounters[n].forEach(c => {
            res.push(`${c.counterName} ${_prevSvcCounters[c.counterName]}`);
          })
        }
      });
      return res.join('\n');
    }

    /**
     * Функция возвращает список всех сервисов
     */
    async getServices() {
      return Object.values(services).filter(svc => !!svc._service).map(svc => formatService(svc._service));
    }

    /**
     * Функция возвращает сервис
     */
    async getService({name = missingArgument("name")}) {
      const {
        [name]: svc = missingService(name),
      } = services;
      return svc && formatService(svc._service) || null;
    }

    /**
     * Принудительная остановка сервиса
     */
    async stopService({name = missingArgument("name")}) {
      const {
        [name]: svc = missingService(name),
      } = services;
      svc._service.stop();
      return {
        result: 'ok',
      };
    }

    /**
     * Запуск сервиса
     */
    async startService({name = missingArgument("name")}) {
      const {
        [name]: svc = missingService(name),
      } = services;
      svc._service.start();
      return {
        result: 'ok',
      };
    }
  }

  defineProps(Monitoring, {
    isRunning: {
      get() {
        return _isRunning;
      }
    }
  });

  return new (require('../services/index').Service(services)(Monitoring, {contextRequired: true}))(name, {
    ...configAPI.get('monitoring'),
  });
});

/**
 * Функция для преобразования объекта сервиса в нужный для GraphQL схемы формат.
 * @param service - объект сервиса
 * @returns {{dependenciesReady: (void|boolean|*|null), stop: (void|boolean|*|null), serviceError: (void|null|*|Error|string), name: (void|string|null), state: (void|string|*|null)}}
 */
function formatService(service = missingArgument("service")) {
  return {
    name: service._name,
    state: service._state,
    stop: service._stop,
    dependenciesReady: service._isAllDependsAreReady,
    serviceError: service._failureReason && service._failureReason.message,
  };
}

export function addCounter(args) {
  schema.addCounterFunction_args(args);
  const {serviceName, name, type} = args;
  const builder = counterBuilders[type];
  if (!builder) {
    throw new Error(`Unknown counter type: ${type}`);
  }
  const counter = builder(serviceName, name);
  if (!_svcCounters[serviceName]) {
    _svcCounters[serviceName] = [counter];
  } else {
    _svcCounters[serviceName].push(counter);
  }
  _prevSvcCounters[counter.counterName] = counter.initValue;
  return counter;
}

export function monitoringHook(ev, bus) {
  if (ev.type === 'webserver.started') {
    _isRunning = true;
  }
  if (ev.type === 'service.state') {
    if (!hasOwnProperty.call(_svc, ev.service)) { // регистрируем в списке сервис, если видим его первый раз
      _svcList.push(ev.service);
      _svc[ev.service] = 0;
      _svcFail[ev.service] = 0;
    }
    switch (ev.state) {
      case READY: {
        _svc[ev.service] = 1;
        break;
      }
      case FAILED: {
        _svcFail[ev.service]++;
        // break; // fallthru чтобы записать что сервис остановлен
      }
      default: {
        _svc[ev.service] = 0;
      }
    }
  }
}
