import moment from 'moment'
import missingService from './missingService'

import {VType, validateEventFactory, BaseEvent} from '../events'

export default function defineEvents({bus = missingService('bus')}) {
  bus.registerEvent([
    {
      kind: 'info',
      type: 'nodemanager.started',
      validate: validateEventFactory({
        _extends: BaseEvent,
        startDuration: {type: VType.Int().positive()},
        failedServices: {type: VType.Array().onlyStrings()},
      }),
      toString: (ev) => `${ev.source}: node started in ${moment.duration(ev.startDuration).format('h:mm:ss', 3)}${ev.failedServices ? `; failed: ${ev.failedServices.join()}` : ``}`,
    },
  ]);
};
