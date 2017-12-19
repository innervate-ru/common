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
          state: {type: VType.String().notEmpty(), required: true},
          prevState: {type: VType.String().notEmpty(), required: true},
          serviceType: {type: VType.String().notEmpty()},
          reason: {fields: require('../errors/error.schema').errorSchema}, // причина перехода в состояние FAILED - поле message из Error
        }),
        toString: (ev) => {
          // Чтобы не сбивать с толку, при начальном запуске не выводим сообщение что сервис перешел в состояние stopped
          if (ev.prevState === NOT_INITIALIZED || ev.prevState === WAITING_OTHER_SERVICES_TO_START_OR_FAIL || ev.prevState === INITIALIZING) return;
          return `${ev.source}: state: '${ev.state}'${ev.reason ? ` (reason: '${ev.reason.message}')` : ``}`
        },
      },
      // service.error
      {
        kind: 'error',
        type: 'service.error',
        validate: validateEventFactory(Object.assign({
            _extends: BaseEvent,
            serviceType: {type: VType.String().notEmpty()},
          },
          require('../errors/error.schema').errorSchema)
        ),
        toString: (ev) =>
          (testMode && testMode.service) ? `${ev.source}: error: '${ev.errorMessage}'` : // для testMode специальное сообщение, которое легко проверять и оно не содержит stack
            `${ev.source}: ${ev.errorStack}`,
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
        toString: ev => `${ev.source}: settings: '${prettyPrint(ev.settings)}'`,
      },
    ]
  );
})
