import {oncePerServices} from "../services";
import onHeaders from 'on-headers'
import requestIp from 'request-ip'
import {nanoid} from 'nanoid'

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

      const service = options?.service || 'express';

      if (!req.context) {
        req.context = nanoid();

        const ip = requestIp.getClientIp(req);
        req.userIp = ip.startsWith('::ffff:') ? ip.substr(7) : ip; // удаляем префикс ipV6 для ipV4 адресов
      }

      onHeaders(res, function () {

        let query = req.query;
        if (hasOwnProperty.call(query, 'auth')) {
          let auth;
          ({auth, ...query} = query);
        }

        const path = req.baseUrl + req.path;

        const httpEvent = {
          ...(() => {
            if (req.user) {
              const {id, ...rest} = req.user;
              return rest;
            }
          })(),
          type: 'http.request',
          service: res.service || service,
          context: req.context,
          agent: req.get('user-agent'),
          ip: req.userIp,
          duration: Date.now() - startTime,
          statusCode: res.statusCode,
          method: req.method,
          path,
          query,
        };

        const hostname = req.hostname;
        if (hostname) {
          httpEvent.hostname = hostname;
        }

        bus.method(httpEvent);
      });
      next();
    }
  }
});
