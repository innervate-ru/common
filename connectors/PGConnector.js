import pg from 'pg';
import {missingArgument, invalidArgument} from '../utils/arguments'
import {oncePerServices, fixDependsOn} from '../services'
import addServiceStateValidation from '../services/addServiceStateValidation'

const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;
const schema = require('./PGConnector.schema');

export default oncePerServices(function (services) {

  const {bus = throwIfMissing('bus')} = services;

  class PGConnector {

    constructor(options) {
      schema.ctor_settings(this, options);
      this._options = options;
    }

    async _serviceStart() {
      const settingsWithoutPassword = {...this._options};
      delete settingsWithoutPassword.password;
      fixDependsOn(settingsWithoutPassword);
      bus.info({
        time: new Date().getTime(),
        type: 'service.settings',
        source: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        settings: settingsWithoutPassword,
      });
      this._pool = new pg.Pool(this._options);
      this._pool.on('error', (error, client) => {
        this._service.criticalFailure(error);
      });
      return this._query(`select now();`);
    }

    async _serviceStop() {
      return this._pool.end();
    }

    async connection() {
      return new Promise((resolve, reject) => {
        this._pool.connect(function (err, client, done) {
          if (err) reject(err);
          else resolve(new Connection(this, client, done));
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

  addServiceStateValidation(PGConnector.prototype, function () { return this._service; });

  class Connection {

    constructor(connector, client, done) {
      this._connector = connector;
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

  addServiceStateValidation(Connection.prototype, function () { return this._connector._service; });

  PGConnector.SERVICE_TYPE = SERVICE_TYPE;

  return PGConnector;
});
