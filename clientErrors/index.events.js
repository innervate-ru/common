import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {BaseEvent, validateEventFactory, VType} from "../events";
import prettyPrint from "../utils/prettyPrint";

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  bus.registerEvent([
    {
      kind: 'error',
      type: 'client.error',
      validate: validateEventFactory({
        _extends: BaseEvent,
        state: {type: VType.String().notEmpty()},
      }),
      toString: (ev) => `${ev.service} (${ev.context}): ${prettyPrint(ev.error).slice(0, 80)}`,
    },
  ]);
})
