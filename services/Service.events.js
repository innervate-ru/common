import missingService from './missingService'
import prettyPrint from '../utils/prettyPrint'
import oncePerServices from './oncePerServices'

import {VType, validateEventFactory, BaseEvent} from '../events'

import {
  NOT_INITIALIZED,
  WAITING_OTHER_SERVICES_TO_START_OR_FAIL,
  WAITING_FAILED_TO_START_SERVICE,
  INITIALIZING
} from './Service.states'

let serviceMethod;

export default oncePerServices(function defineEvents({bus = missingService('bus'), testMode}) {

  bus.registerEvent([
      // service.state
      {
        kind: 'event',
        type: 'service.state',
        validate: validateEventFactory({
          _extends: BaseEvent,
          state: {required: true, type: VType.String().notEmpty()},
          prevState: {required: true, type: VType.String().notEmpty()},
          serviceType: {type: VType.String().notEmpty()},
          reasonMessage: {type: VType.String().notEmpty()},
          reason: {fields: require('../errors/error.schema').eventErrorSchema}, // причина перехода в состояние FAILED - поле message из Error
        }),
        toString: (ev) => {
          // Чтобы не сбивать с толку, при начальном запуске не выводим сообщение что сервис перешел в состояние stopped
          if (
            ev.prevState === NOT_INITIALIZED ||
            (ev.prevState === WAITING_OTHER_SERVICES_TO_START_OR_FAIL && ev.state !== WAITING_FAILED_TO_START_SERVICE) ||
            ev.prevState === INITIALIZING)
            return;
          return `${ev.service}: state: '${ev.state}'${(ev.reasonMessage || ev.reason) ? ` (reason: '${ev.reasonMessage || ev.reason.message}')` : ``}`
        },
      },
      // service.error
      {
        kind: 'error',
        type: 'service.error',
        validate: validateEventFactory({
          _extends: BaseEvent,
          serviceType: {type: VType.String().notEmpty()},
          error: {fields: require('../errors/error.schema').eventErrorSchema},
        }),
        toString: (ev) =>
          (testMode && testMode.service) ? `${ev.service}: error: '${ev.error}'` : // для testMode специальное сообщение, которое легко проверять и оно не содержит stack
            `${ev.service}: ${ev.stack}`,
      },
      // service.settings
      {
        kind: 'info',
        type: 'service.settings',
        validate: validateEventFactory({
          _extends: BaseEvent,
          serviceType: {type: VType.String().notEmpty()},
          settings: {type: VType.Object()}, // TODO: Check that all values are serializable to JSON
        }),
        toString: ev => `${ev.service}: settings: ${prettyPrint(ev.settings)}`,
      },
      // service.method
      serviceMethod = {
        kind: 'method',
        type: 'service.method',
        validate: validateEventFactory({
          _extends: BaseEvent,
          method: {type: VType.String().notEmpty()},
          args: {type: VType.Object()},
          duration: {type: VType.Int()},
          failed: {type: VType.Int(), validate: v => v === 1 ? true : 'only 1(one) as value is allowed'},
        }),
        toString: ev => `${ev.service}: ${ev.method}(${prettyPrint(ev.args)}) ${ev.failed ? `failed` : `ok`} in ${ev.duration} ms'`,
      },
      {
        ...serviceMethod,
        kind: 'event',
        type: 'service.method.result',
        result: {type: VType.Any()},
      },
      {
        kind: 'info',
        type: 'service.takesTooLong',
        validate: validateEventFactory({
          _extends: BaseEvent,
          method: {type: VType.String().notEmpty()},
          duration: {type: VType.Int()},
        }),
        toString: ev => `${ev.service}: ${ev.method} takes too long (${Math.round(ev.duration / 1000)} secs) to complete`,
      },
    ]
  );
})
