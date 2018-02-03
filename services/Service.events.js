import missingService from './missingService'
import prettyPrint from '../utils/prettyPrint'
import oncePerServices from './oncePerServices'

import {VType, validateEventFactory, BaseEvent} from '../events'

import {NOT_INITIALIZED, WAITING_OTHER_SERVICES_TO_START_OR_FAIL, INITIALIZING} from './Service.states'

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
          reason: {fields: require('../errors/error.schema').eventErrorSchema}, // причина перехода в состояние FAILED - поле message из Error
        }),
        // toString: (ev) => JSON.stringify(ev, null, 2),
        toString: (ev) => {
          // Чтобы не сбивать с толку, при начальном запуске не выводим сообщение что сервис перешел в состояние stopped
          if (ev.prevState === NOT_INITIALIZED || ev.prevState === WAITING_OTHER_SERVICES_TO_START_OR_FAIL || ev.prevState === INITIALIZING) return;
          return `${ev.service}: state: '${ev.state}'${ev.reason ? ` (reason: '${ev.reason.message}')` : ``}`
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
          (testMode && testMode.service) ? `${ev.service}: error: '${ev.error.message}'` : // для testMode специальное сообщение, которое легко проверять и оно не содержит stack
            `${ev.service}: ${ev.error.stack}`,
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
        toString: ev => `${ev.service}: settings: '${prettyPrint(ev.settings)}'`,
      },
    ]
  );
})
