import moment from 'moment'
import missingService from './missingService'
import {VType, validateEventFactory, BaseEvent} from '../events'
import {validateAndCopyOptionsFactory} from '../validation'

export const nodeManagerClassOptions = validateAndCopyOptionsFactory({
  name: {type: VType.String(), required: true, copy: true},
  services: {type: VType.Array()},
});

export const defineEvents = require('lodash/once')(function ({bus = missingService('bus'), testMode}) {
  bus.registerEvent([
      {
        kind: 'info',
        type: 'nodemanager.started',
        validate: validateEventFactory({
          _extends: BaseEvent,
          startDuration: {type: VType.Int().positive()},
          failedServices: {type: VType.Array().onlyStrings()},
        }),
        toString: (ev) => `${ev.source}: started in ${moment.duration(ev.startDuration).format('h:mm:ss', 3)}${ev.failedServices ? `; failed: ${ev.failedServices.join()}` : ``}`,
      },
    ]);
});