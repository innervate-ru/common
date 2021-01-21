import {oncePerServices} from '../services'

export default oncePerServices(function (services) {

  const postWrapper = require('./postWrapper').default(services);

  return function ({context, expressApp}) {
    const urls = [];
    for (const svcName in services) {
      const svc = services[svcName];
      if (typeof svc !== 'object') continue;
      let level = svc.__proto__;
      while (level) {
        if (level.hasOwnProperty('__http')) {
          let http = level.__http; // added by @http (./index.js)
          if (http) {
            const url = level.__http?.['']?.url || `/api/${svcName}`;
            for (const methodName in http) {
              if (methodName === '') continue;
              const path = `${url}/${methodName}`;
              const {name, ...rest} = http[methodName];
              urls.push({path, name});
              postWrapper((() => {
                const r = {
                  ...rest,
                  context,
                  expressApp,
                  path,
                  service: svc,
                  method: svc[methodName].bind(svc),
                };
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
