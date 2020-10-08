import {oncePerServices, missingExport} from '../../common/services'
import configAPI from 'config'
import missingService from '../services/missingService'
import requestIp from 'request-ip'
import nanoid from 'nanoid'
import jwt, {TokenExpiredError} from 'jsonwebtoken'

const debug = require('debug')('auth');

const secret = configAPI.get('secret.value');

const schema = require('./index.schema');

export const name = 'auth';

export default oncePerServices(function (services) {

  const {
    bus,
    postgres = missingService('postgres'),
  } = services;

  class Auth {

    constructor(settings) {

      // TODO: Invistigate
      // schema.ctor_settings({...settings});

      this._settings = settings;
      this._expirationPeriod = settings.expirationPeriod;
      this._extraTime = settings.extraTime;
      this._postgres = postgres;

      this._updateUser = [];

      this.middleware = (req, resp, next) => {

        const context = req.context || nanoid();

        req.context = context;

        const ip = requestIp.getClientIp(req);
        req.userIp = ip.startsWith('::ffff:') ? ip.substr(7) : ip; // удаляем префикс ipV6 для ipV4 адресов

        let auth = req.query.auth;

        if (!auth && req.headers.authorization) {
          const r = req.headers.authorization.split(' ');
          if (r.length === 2 && r[0] === 'Bearer') {
            auth = r[1];
          }
        }

        if (!auth) {
          res.status(401).send('Authorization token is required');
          return;
        }

        let token;
        try {
          token = this._parseToken({context, token: auth, isExpiredOk: false});
        } catch (err) {
          next(err);
          return;
        }

        req.session = token.session;

        if (token.user) {
          req.user = token.user;
        }

        next();
      };
    }

    async _serviceInit() {
      bus.info({
        type: 'service.settings',
        service: this._service.name,
        settings: this._settings,
      });
    }

    async newSession(args) {

      schema.newSession_args(args);

      const {context, userIp, isTestToken} = args; // Если тестовый токен, то не создаем сессию в БД

      const session = nanoid();
      debug('new session %s', session);

      if (!isTestToken) {
        await postgres.exec({
          context,
          statement: 'insert into session(id, ip) values ($1, $2);',
          params: [session, userIp]
        });
      }

      return session;
    }

    async extendSession(args) {

      console.info(97, args)

      schema.extendSession_args(args);

      const {context, userIp, isTestToken} = args;
      let {session, user} = args;

      if (session) {

        let {rowCount, rows} =
          isTestToken ?
            {rowCount: 1, rows: [{active: true}]} :
            await postgres.exec({
              context,
              statement: 'update session set last_seeing = now() where id = $1 returning active;',
              params: [session]
            });

        debug('rowCount %d, active: %s', rowCount, (rowCount > 0 ? rows[0].active : 'n/a'));

        if (rowCount === 0 || !rows[0].active) { // сессия или была деактивированна, или её удалили из БД
          debug('session is missing');
          session = await _newSession({context, userIp, isTestToken});
          user = null;
        } else if (user) { // если укзаан пользователь
          const givenUser = user;
          user = null;
          for (const updateUser of this._updateUser) {
            user = updateUser(givenUser);
            if (user === false) { // пользователь заблокирован
              debug('user is missing or blocked');
              user = null;
              break;
            } else if (newUser) { // новые данные по пользователю
              break;
            }
          }
        }

        const res = {session};
        if (user) {
          res.user = user;
        }
        return res;

      } else {

        return {session: await this._newSession({context, userIp})};
      }
    }

    async login(args) {

      schema.login_args(args);

      const {context, session, userEmail, user} = args;

      let {rowCount} = await postgres.exec({
        statement: 'update session set user_email = $2, last_seeing = now() where active = true and id = $1;',
        params: [session, userEmail],
      });

      if (rowCount === 0) {
        throw Error(`Session '${session}' not found`);
      }

      return {session, user};
    }

    async logout(args) {

      schema.logout_args(args);

      const {context, session} = args;

      return {session};
    }

    _parseToken(args) {

      schema.parseToken_args(args);

      const {context, token, isExpiredOk} = args;
      try {
        return jwt.verify(token, secret);
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          if (isExpiredOk) {
            return jwt.decode(token);
          } else {
            throw new Error('tokenExpired');
          }
        } else {
          throw err;
        }
      }
    }

    _signToken(args) {

      schema.signToken_args(args);

      const {context, token} = args;

      return jwt.sign(token, secret, {expiresIn: this._expirationPeriod + this._extraTime});
    }

    _addUpdateUser(args) {

      schema.addUpdateUser_args(args);

      this._updateUser.push(args.updateUserHandler);
    }
  }

  return new (require('../services').Service(services)(Auth, {contextRequired: true}))(name, {
    ...configAPI.get('jwt'),
    dependsOn: [postgres],
  });

});


