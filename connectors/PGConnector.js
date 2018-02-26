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

    constructor(options) {
      schema.ctor_settings(this, options);
      const {debugWithFakeTimer, ...rest} = options;
      this._testTimer = pgTestTime(testMode && testMode.postgres);
      this._options = rest;
      this._channels = Object.create(null);
      this._channels._keepAlive = Object.create(null);
      this._channels._keepAlive.name = `_keepAlive`;
    }

    async _serviceStart() {
      const settingsWithoutPassword = {...this._options};
      delete settingsWithoutPassword.password;
      fixDependsOn(settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        settings: settingsWithoutPassword,
      });
      this._pool = new Pool(this._options);
      this._pool.on('error', (error) => { // сюда приходят только ошибки связанные с разрывом соединения
        if (this._service.state === READY) this._service.criticalFailure(error);
      });
      let connected;
      if (this._channels) connected = (await Promise.all(Object.values(this._channels).map(channel => this._fixChannel(channel, true)))).some(v => v === true);
      if (connected !== true) // если _fixChannel вернет true, значит он успешно подключился к БД, и другая проверка не нужна
        await this._exec({statement: `select now()::timestamp;`});
    }

    async _serviceStop() {
      await Promise.all([
        this._pool.end(),
        ...Object.values(this._channels).map(channel => this._fixChannel(channel, false)),
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
          const client = channel.client = new Client(this._options);
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

  serviceMethodWrapper(PGConnector.prototype, bus, function () {
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

    async sendMessage(args) {

      schema.sendMessage_args(args);

      let {channel, message} = args;

      if (typeof message === 'object') message = JSON.stringify(message);

      await this._exec({
        statement: `select pg_notify($1, $2);`,
        params: [channel, message],
      });
    }

    async end() {
      this._done();
      this._done = null;
    }
  }

  serviceMethodWrapper(Connection.prototype, bus, function () {
    return this._connector._service;
  });

  PGConnector.SERVICE_TYPE = SERVICE_TYPE;

  return PGConnector;
});
