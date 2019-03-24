import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {BaseEvent, validateEventFactory, VType} from "../events";

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {
  bus.registerEvent([
    {
      kind: 'method',
      type: 'http.request',
      validate: validateEventFactory({
        _extends: BaseEvent,
        duration: {required: true, type: VType.Int().positive().zero()},
        statusCode: {required: true, type: VType.Int().positive()},
        method: {required: true, type: VType.String().notEmpty()},
        path: {required: true, type: VType.String().notEmpty()},
        query: {type: VType.Object()},
        hostname: {type: VType.String().notEmpty()},
        userAgent: {type: VType.String().notEmpty()},
        email: {type: VType.String().notEmpty()},
        username: {type: VType.String().notEmpty()},
        appId: {type: VType.String().notEmpty()},
      }),
      toString: (ev) => `${ev.service}: ${ev.path} (${ev.context})`,
    },
  ]);
})
