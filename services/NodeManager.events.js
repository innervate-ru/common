import oncePerServices from './oncePerServices'
import moment from 'moment'
import 'moment-duration-format'
import missingService from './missingService'

import {VType, validateEventFactory, BaseEvent} from '../events'

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {
  bus.registerEvent([
    {
      kind: 'info',
      type: 'nodemanager.started',
      validate: validateEventFactory({
        _extends: BaseEvent,
        startDuration: {type: VType.Int().positive().zero()}, // значение ноль может быть во время тестирования с fake timer'ом
        failedServices: {type: VType.Array().onlyStrings()},
      }),
      toString: (ev) => `${ev.service}: node started in ${moment.duration(ev.startDuration).format('h:mm:ss', 3)}${ev.failedServices ? `; failed: ${ev.failedServices.join(', ')}` : ``}`,
    },
    // service.error
    {
      kind: 'error',
      type: 'nodemanager.error',
      validate: validateEventFactory({
        _extends: BaseEvent,
        serviceType: {type: VType.String().notEmpty()},
        error: {fields: require('../errors/error.schema').eventErrorSchema},
      }),
      toString: (ev) => `${ev.service}: ${ev.error.stack}`,
    },
    // service.error
    {
      kind: 'event',
      type: 'nodemanager.health',
      validate: validateEventFactory({
        _extends: BaseEvent,
        _final:false,
      }),
    },
  ]);
})
