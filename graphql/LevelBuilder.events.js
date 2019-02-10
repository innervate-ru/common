import missingService from '../services/missingService'
import oncePerServices from '../services/oncePerServices'

import {VType, validateEventFactory, BaseEvent} from '../events'

export default oncePerServices(function defineEvents({bus = missingService('bus'), testMode}) {
  bus.registerEvent([
      {
        kind: 'info',
        type: 'graphql.builderTakesTooLong',
        validate: validateEventFactory({
          _extends: BaseEvent,
          name: {type: VType.String().notEmpty()},
          duration: {type: VType.Int()},
        }),
        toString: ev => `${ev.service}: ${ev.name} takes too long (${Math.round(ev.duration / 1000)} secs) to build`,
      },
    ]
  );
})
