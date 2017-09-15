import missingService from './missingService'
import prettyPrint from '../utils/prettyPrint'

import {VType, validateEventFactory, BaseEvent} from '../events'

import {NOT_INITIALIZED, WAITING_OTHER_SERVICES_TO_START, INITIALIZING, STOPPED, STARTING} from './Service.states'

const PGConnectorService = require('../connectors/PGConnector.serviceType').SERVICE_TYPE;
const SoapConnectorService = require('../connectors/SoapConnector.serviceType').SERVICE_TYPE;

export default function defineEvents({bus = missingService('bus'), testMode}) {

  bus.registerEvent([
      // service.state
      {
        kind: 'event',
        type: 'service.state',
        validate: validateEventFactory({
          _extends: BaseEvent,
          state: {type: VType.String().notEmpty(), required: true},
          prevState: {type: VType.String().notEmpty(), required: true},
          serviceType: {type: VType.String().notEmpty()},
          reason: {type: VType.String()}, // причина перехода в состояние FAILED - поле message из Error
        }),
        toString: (ev) => {
          // Чтобы не сбивать с толку, при начальном запуске не выводим сообщение что сервис перешел в состояние stopped
          if (ev.prevState === NOT_INITIALIZED || ev.prevState === WAITING_OTHER_SERVICES_TO_START || ev.prevState === INITIALIZING) return;
          return `${ev.source}: state: '${ev.state}'${ev.reason ? ` (reason: '${ev.reason}')` : ``}`
        },
      },
      // service.error
      {
        kind: 'error',
        type: 'service.error',
        validate: validateEventFactory({ // TODO: Fix
          _extends: BaseEvent,
          serviceType: {type: VType.String().notEmpty()}
          message: {type: VType.String().notEmpty(), required: true},
          stack: {type: VType.String().notEmpty()},
        }),
        toString: (ev) =>
          testMode ? `${ev.source}: error: '${ev.message}'` : // для testMode специальное сообщение, которое легко проверять и оно не содержит stack
            `${ev.source}: error '${ev.message}'\n${ev.stack}`,
      },
      // service.options
      {
        kind: 'info',
        type: 'service.options',
        validate: validateEventFactory({ // TODO: Fix
          _extends: BaseEvent,
          serviceType: {type: VType.String().notEmpty()},
          options: {type: VType.Object()},
        }),
        toString: ev => `${ev.source}: options: '${prettyPrint(ev.options)}'`,
      },
    ]
  );
}
