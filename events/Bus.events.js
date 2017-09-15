import missingService from '../services/missingService'
import {VType, validateEventFactory, BaseEvent} from '../events'

export default function defineEvents({bus = missingService('bus')}) {
  bus.registerEvent([
    {
      kind: 'warn',
      type: 'bus.unmetAlterToStrings',
      validate: validateEventFactory({
        _extends: BaseEvent,
        unmetAlterToStrings: {type: VType.Array().notEmpty().onlyStrings()},
      }),
    },
  ]);
};
