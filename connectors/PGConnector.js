import {Pool, Client} from 'pg';
import {oncePerServices, fixDependsOn} from '../services'
import serviceMethodWrapper from '../services/serviceMethodWrapper'
import pgTestTime from '../utils/pgTestTime'

const {READY} = require('../services/Service.states');
const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;
const schema = require('./PGConnector.schema');

const hasOwnProperty = Object.prototype.hasOwnProperty;

export default oncePerServices(function (services) {

  const {bus = throwIfMissing('bus'), testMode} = services;

  class PGConnector {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      const {debugWithFakeTimer, ...rest} = settings;
      this._testTimer = pgTestTime(testMode && testMode.postgres);
      this._settings = rest;
      this._channels = Object.create(null);
      this._channels._keepAlive = Object.create(null);
      this._channels._keepAlive.name = `_keepAlive`;
    }

    async _serviceInit() {
      const settingsWithoutPassword = {...this._settings};
      delete settingsWithoutPassword.password;
      fixDependsOn(settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.name,
        serviceType: SERVICE_TYPE,
        settings: settingsWithoutPassword,
      });
    }

    async _servicePrestart() {
      this._pool = new Pool(this._settings);
      this._pool.on('error', (error) => { // сюда приходят только ошибки связанные с разрывом соединения
        if (this._service.state === READY) this._service.criticalFailure(error);
      });
    }

    async _serviceCheck() {
      await this._exec({statement: `select now()::timestamp;`});
    }

    _serviceIsCriticalError(error) {
      return error.code === 'ECONNRESET';
    }

    async _serviceStart() {
      if (this._channels) {
        await Promise.all(Object.values(this._channels).map(channel => this._fixChannel(channel, true)));
      }
    }

    async _serviceStop() {
      this._pool.end();
      delete this._pool;
      Object.values(this._channels).forEach(channel => { this._fixChannel(channel, false); });
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

    async exec(args) {
      const connection = await this._innerConnection();
      try {
        return connection._exec(args);
      } finally {
        connection._end();
      }
    }

    async sendMessage(args) {
      const connection = await this._innerConnection();
      try {
        return connection._sendMessage(args);
      } finally {
        connection._end();
      }
    }

    async onNotification(args) {

      schema.onNotification_args(args);

      const {channel: channelName, handler, parseJSON} = args;

      const channelsMap = (this._channels || (this._channels = Object.create(null)));

      let channel = channelsMap[channelName];
      if (!channel) {
        channelsMap[channelName] = channel = Object.create(null);
        channel.name = channelName;
      }

      (channel.handlers || (channel.handlers = [])).push(parseJSON ? (message => {
        if (!message.json) message.json = JSON.parse(message.payload);
        return handler(message);
      }) : handler);

      await this._fixChannel(channel, this._service.state === READY);

      let subscribed = true;
      return async() => {

        if (!subscribed) return;
        subscribed = false;

        if (channel.handlers.length === 1) {
          delete channel.handlers;
          await this._fixChannel(channel, this._service.state === READY);
        } else {
          channel.handlers.splice(channel.handlers.indexOf(handler), 1);
        }
      }
    }

    /**
     * Открывает или закрывает канал получение notification от postgres.  Канал открывается, если есть handlers и сервис
     * находится в запущенном состоянии.  Иначе, канал, если открыт, будет закрыт.
     */
    async _fixChannel(channel, isReady) {

      const doListen =
        isReady &&
        (channel.name === '_keepAlive' || channel.handlers);

      if (doListen) {
        if (!channel.client) {
          const client = channel.client = new Client(this._settings);
          client.on('error', (error) => { // сюда приходят только ошибки связанные с разрывом соединения
            if (this._service.state === READY) this._service.criticalFailure(error);
          });
          await client.connect();
          client.on(`notification`, (message) => {
            const handlers = channel.handlers;
            handlers && handlers.forEach(h => h(message));
          });
          await client.query(`listen ${channel.name};`);
          return true;
        }
      } else {
        if (channel.client) {
          const client = channel.client;
          delete channel.client;
          return client.end();
        }
      }
    }

  }

  serviceMethodWrapper({prototypeOrInstance: PGConnector.prototype, bus, getService: function () {
    return this._service;
  }});

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

      const {name, statement, params, catchError} = args;

      if (!catchError) {
        return this._client.query({name, text: statement, values: params});
      } else {
        try {
          return await this._client.query({name, text: statement, values: params});
        } catch (err) {
          const res = catchError(err);
          if (res) {
            return res;
          } else {
            throw err;
          }
        }
      }
    }

    async sendMessage(args) {

      schema.sendMessage_args(args);

      let {channel, message} = args;

      if (typeof message === 'object') message = JSON.stringify(message);

      await this._exec({
        name: `SsGKGTqr2H2TF5XQkcr4y`,
        statement: `select pg_notify($1, $2);`,
        params: [channel, message],
      });
    }

    end() {
      this._done();
      this._done = null;
    }
  }

  serviceMethodWrapper({prototypeOrInstance: Connection.prototype, bus, getService: function () {
    return this._connector._service;
  }});

  PGConnector.SERVICE_TYPE = SERVICE_TYPE;

  return PGConnector;
});
