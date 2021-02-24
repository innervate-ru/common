import {nanoid} from 'nanoid'
import {missingService, oncePerServices} from '../services'
import requestIp from 'request-ip'
import express from 'express'

const debug = require('debug')('auth');

const schema = require('./index.schema');

const service = 'auth';

export default oncePerServices(function (services) {

  const {
    bus,
    auth = missingService('auth'),
  } = services;

  return function (args) {
    schema.middleware_args(args);
    const {expressApp} = args;
    const path = '/api/user';
    expressApp.post(path,
      express.text(),
      async (req, resp, next) => {
        const context = nanoid();
        const time = (new Date()).toISOString();
        const ip = requestIp.getClientIp(req);
        let newToken;
        try {
          newToken =
            req.body ?
              await auth.extendSession({...auth._parseToken({context, token: req.body, isExpiredOk: true}), context, userIp: ip}) :
              {session: await auth.newSession({context, userIp: ip})};
        } catch (err) {
          err.context = nanoid();
          auth._service._reportError(err);
          newToken = {session: await auth.newSession({context, userIp: ip})};
        }
        resp.json({
          time,
          refreshIn: auth._expirationPeriod,
          token: auth._signToken({context, token: newToken}),
        });
      }
    );
    return [{path, name: 'create / extend user token'}]
  };
});
