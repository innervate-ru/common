import prettyPrint from '../utils/prettyPrint'
import {missingArgument, invalidArgument} from '../utils/arguments'

import defineProps from '../utils/defineProps'
import {
  validateAndCopyOptionsFactory,
  validateArgumentNameOptions,
  VType,
} from '../validation'

import pg from 'pg';

const validateOptions = validateAndCopyOptionsFactory({
  description: {type: VType.String()},
  url: {type: VType.String().notEmpty(), required: true},
  port: {type: VType.Int()},
  user: {type: VType.String().notEmpty(), required: true},
  password: {type: VType.String().notEmpty(), required: true},
  database: {type: VType.String().notEmpty(), required: true},
  max: {type: VType.Int().positive()},
  idleTimeoutMillis: {type: VType.Int().positive()},
  // TODO: Посмотреть в код pg, выписать все опции
});

export function config(services) {
  // nothing
}

const validateConnectionOptions = validateAndCopyOptionsFactory({
  cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
});

const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;

export default function (services) {

  const {bus = throwIfMissing('bus')} = services;

  class Postgres {

    constructor(options) {
      validateOptions(options, validateArgumentNameOptions);
      this._options = options;
    }

    async _serviceStart() {
      const optsWithoutPassword = {...this._options};
      delete optsWithoutPassword.password;
      bus.info({
        time: new Date().getTime(),
        type: 'service.options',
        source: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        options: optsWithoutPassword,
      });
      this._pool = new pg.Pool(this._options);
      this._pool.on('error', (error, client) => {
        this._service.criticalFailure(error);
      });
      return this.query(`select now();`);
    }

    async _serviceStop() {
      return this._pool.end();
    }

    async connection() {
      return new Promise((resolve, reject) => {
        this._pool.connect(function (err, client, done) {
          if (err) reject(err);
          else resolve(new Connection(client, done));
        });
      })
    }

    async query(statement = missingArgument('statement'), args) {
      return new Promise((resolve, reject) => {
        this._pool.connect(function (err, client, done) {
          if (err) {
            done();
            reject(err);
          }
          else {
            client.query(statement, args, function (err, results) {
              done();
              if (err) reject(err);
              else resolve(results);
            });
          }
        });
      })
    }
  }

  class Connection {

    constructor(client, done) {
      this._connection = client;
      this._done = done;
    }

    // TODO: Add 'cancel' option
    async query(statement = missingArgument('statement'), args) {
      return new Promise((resolve, reject) => {
        this._connection.query(statement, args, function (err, results) {
          if (err) reject(err);
          else resolve(results);
        });
      });
    }

    async end() {
      this._done();
      this._done = null;
    }
  }

  Postgres.SERVICE_TYPE = SERVICE_TYPE;

  return Postgres;
}
