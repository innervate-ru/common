import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {VType, validateEventFactory, BaseEvent} from '../events'

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {
  bus.registerEvent([
    {
      kind: 'warn',
      type: 'bus.unmetAlterToStrings',
      validate: validateEventFactory({
        _extends: BaseEvent,
        unmetAlterToStrings: {type: VType.Array().notEmpty().onlyStrings()},
      }),
    },
    {
      kind: 'error',
      type: 'unhandled.error',
      validate: validateEventFactory({
        _extends: BaseEvent,
        error: {fields: require('../errors/error.schema').eventErrorSchema},
      }),
      toString: (ev) => `${ev.service}: ${ev.error.stack || ev.error.message}`,
    },
  ]);
})
