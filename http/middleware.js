import {oncePerServices} from '../services'

export default oncePerServices(function (services) {

  const postWrapper = require('./postWrapper').default(services);

  return function ({context, expressApp, auth}) {
    const urls = [];
    for (const svcName in services) {
      console.info(9, svcName)
      const svc = services[svcName];
      if (typeof svc !== 'object') continue;
      let level = svc.__proto__;
      while (level) {
        if (level.hasOwnProperty('__http')) {
          let http = level.__http; // added by @http (./index.js)
          console.info(15, http)
          if (http) {
            for (const methodName in http) {
              const path = `${svcName}/${methodName}`;
              const {name, ...rest} = http[methodName];
              urls.push({path, name});
              postWrapper((() => {
                const r = {
                  ...rest,
                  context,
                  expressApp,
                  path,
                  method: svc[methodName].bind(svc),
                };
                if (auth) r.auth = auth;
                return r;
              })());
            }
          }
        }
        level = level.__proto__;
      }
    }
    return urls;
  }
});
