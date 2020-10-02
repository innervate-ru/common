import {oncePerServices} from '../services'
import postWrapper from './postWrapper'

export default oncePerServices(function (services) {

  return function ({expressApp, auth}) {
    const paths = [];
    for (svcName in services) {
      const svc = services[svcName];
      if (typeof svc !== 'object') continue;
      let level = svc.__proto;
      while (level) {
        let http = level.__http; // added by @http (./index.js)
        if (http) {
          for (methodName in http) {
            postWrapper((() => {
              const r = {
                ...http[methodName],
                expressApp,
                auth,
                path: `${serviceName}/${methodName}`,
                method: svc[methodNamt].bind(svc),
              };
              if (auth) r.auth = auth;
              return r;
            })());
          }
        }
        level = level.__proto__;
      }
    }
  }
};
