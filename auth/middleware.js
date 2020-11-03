import nanoid from 'nanoid'
import {missingService, oncePerServices} from '../services'
import requestIp from 'request-ip'
import express from 'express'

const debug = require('debug')('auth');

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus,
    auth = missingService('auth'),
  } = services;

  return function (args) {
    schema.middleware_args(args);
    const {expressApp} = args;
    const path = '/api/user';
    expressApp.post(path, express.text(),
      async (req, resp, next) => {
        const context = nanoid();
        const time = (new Date()).toISOString();
        const ip = requestIp.getClientIp(req);
        req.userIp = ip.startsWith('::ffff:') ? ip.substr(7) : ip; // удаляем префикс ipV6 для ipV4 адресов
        try {
          console.info(28, auth._parseToken({context, token: req.body, isExpiredOk: true}))
          const newToken =
            req.body ?
              await auth.extendSession({...auth._parseToken({context, token: req.body, isExpiredOk: true}), context, userIp: ip}) :
              {session: await auth.newSession({context, userIp: ip})};
          resp.json({
            time,
            refreshIn: auth._expirationPeriod,
            token: auth._signToken({context, token: newToken}),
          });
        } catch (err) {
          next(err);
        }
      }
    );
    return [{path, name: 'create / extend user token'}]
  };
});
