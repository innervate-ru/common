import {Pool, Client} from 'pg';
import {oncePerServices, fixDependsOn} from '../services'
import addServiceStateValidation from '../services/addServiceStateValidation'
import pgTestTime from '../utils/pgTestTime'

const {READY} = require('../services/Service.states');
const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;
const schema = require('./PGConnector.schema');

export default oncePerServices(function (services) {

  const {bus = throwIfMissing('bus'), testMode} = services;

  class PGConnector {

    constructor(options) {
      schema.ctor_settings(this, options);
      const {debugWithFakeTimer, ...rest} = options;
      this._testTimer = pgTestTime(testMode && testMode.postgres);
      this._options = rest;
    }

    async _serviceStart() {
      const settingsWithoutPassword = {...this._options};
      delete settingsWithoutPassword.password;
      fixDependsOn(settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        source: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        settings: settingsWithoutPassword,
      });
      this._pool = new Pool(this._options);
      this._pool.on('error', (error, client) => {
        this._service.criticalFailure(error);
      });
      if (!(await this._checkListen(true) === true)) // если _checkListen вернет true, значит он успешно подключился к БД, и другая проверка не нужна
        await this._exec({statement: `select now()::timestamp;`});
    }

    async _serviceStop() {
      return Promise.all([
        this._pool.end(),
        this._checkListen(),
      ]);
    }

    async connection() {
      return this._innerConnection();
    }

    async _innerConnection() {
      const self = this;
      return new Promise((resolve, reject) => {
        this._pool.connect(function (err, client, done) {
          if (err) reject(err);
          else resolve(new Connection(self, client, done));
        });
      })
    }

    async _checkListen(isStarting) {

      const doListen =
        (isStarting || this._service.state === READY) &&
        this._notificationHandlers;

      if (doListen) {
        if (!this._notificationClient) {
          const client = this._notificationClient = new Client(this._options);
          await client.connect();
          client.on(`notification`, (msg) => {
            const handlers = this._notificationHandlers;
            handlers && handlers.forEach(h => h(msg));
          });
          await client.query('listen events;')
          return true;
        }
      } else {
        if (this._notificationClient) {
          const client = this._notificationClient;
          delete this._notificationClient;
          return client.end();
        }
      }
    }

    async exec(args) {
      const connection = await this._innerConnection();
      try {
        return connection._exec(args);
      } finally {
        connection._end();
      }
    }

    async sendEvent(args) {
      const connection = await this._innerConnection();
      try {
        return connection._sendEvent(args);
      } finally {
        connection._end();
      }
    }

    async onNotification(args) {

      schema.onNotification_args(args);

      const {handler} = args;

      (this._notificationHandlers || (this._notificationHandlers = [])).push(handler);
      await this._checkListen();

      let subscribed = true;
      return async() => {

        if (!subscribed) return;
        subscribed = false;

        if (this._notificationHandlers.length === 1) {
          delete this._notificationHandlers;
          await this._checkListen();
        } else {
          this._notificationHandlers.splice(this._notificationHandlers.indexOf(handler), 1);
        }
      }
    }
  }

  addServiceStateValidation(PGConnector.prototype, function () {
    return this._service;
  });

  class Connection {

    constructor(connector, client, done) {
      this._connector = connector;
      this._testTimer = connector._testTimer;
      this._client = client;
      this._done = done;
    }

    async exec(args) {

      schema.exec_args(args);

      args = this._testTimer(args);

      const {statement, params} = args;

      return new Promise((resolve, reject) => {
        this._client.query(statement, params, function (err, results) {
          if (err) reject(err);
          else resolve(results);
        });
      });
    }

    async sendEvent(args) {

      schema.sendEvent_args(args);

      const {event} = args;

      return this._exec({
        statement: `select pg_notify('events', $1);`,
        params: [event],
      });
    }

    async end() {
      this._done();
      this._done = null;
    }
  }

  addServiceStateValidation(Connection.prototype, function () {
    return this._connector._service;
  });

  PGConnector.SERVICE_TYPE = SERVICE_TYPE;

  return PGConnector;
});
