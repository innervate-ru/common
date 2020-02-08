import {oncePerServices} from "../services";
import onHeaders from 'on-headers'
import requestIp from 'request-ip'
import nanoid from 'nanoid'

const hasOwnProperty = Object.prototype.hasOwnProperty;

const schema = require('./accessLog.schema');

export default oncePerServices(function (services) {

  const {
    bus
  } = services;

  return function (options) {
    schema.options(options);
    return function accessLog(req, res, next) {
      const startTime = Date.now();
      const ip = requestIp.getClientIp(req);
      const service = (options && options.service) || 'express';
      req.context = {
        reqId: nanoid(),
        userIp: ip.startsWith('::ffff:') ? ip.substr(7) : ip, // удаляем префикс ipV6 для ipV4 адресов
      };
      onHeaders(res, function () {

        const reqContext = req.context;

        let query = req.query;
        if (hasOwnProperty.call(query, 'auth')) {
          let auth;
          ({auth, ...query} = query);
        }

        const path = req.baseUrl + req.path;

        const httpEvent = {
          type: 'http.request',
          service: res.service || service,
          context: reqContext.reqId,
          duration: Date.now() - startTime,
          statusCode: res.statusCode,
          method: req.method,
          headers: req.headers,
          path,
          query,
        };

        const hostname = req.hostname;
        if (hostname) {
          httpEvent.hostname = hostname;
        }

        for (const key in reqContext) {
          switch (key) {
            case 'reqId':
              break;
            default: {
              httpEvent[key] = reqContext[key];
            }
          }
        }

        bus.method(httpEvent);
      });
      next();
    }
  }
});
