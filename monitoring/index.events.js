import missingService from '../services/missingService'
import oncePerServices from '../services/oncePerServices'

import {VType, validateEventFactory, BaseEvent} from '../events/index'

export default oncePerServices(function defineEvents({bus = missingService('bus'), testMode}) {

  bus.registerEvent([
    // service.error
    {
      kind: 'error',
      type: 'monitoring.error',
      validate: validateEventFactory({
        _extends: BaseEvent,
        reason: {required: true, type: VType.String().notEmpty()},
        serviceName: {required: true, type: VType.String().notEmpty()},
      }),
      toString: (ev) =>
        ev.reason === 'webserver.started' ?
          `${ev.service}: error: webserver started before monitoring service` :
          `${ev.service}: error: service '${ev.serviceName}' started before monitoring service`,
    },
  ]);
})
