import {missingArgument} from '../validation'
import prettyPrint from '../utils/prettyPrint'
import {oncePerServices, serviceMethodWrapper, fixDependsOn, READY} from '../services'
import defineProps from '../utils/defineProps'
import ConnectionPool from 'tedious-connection-pool'
import {Request, ConnectionError} from 'tedious'
import {stringToTediousTypeMap, tediouseTypeByValue} from './MsSqlConnector.types'
import addPrefixToErrorMessage from '../utils/addPrefixToErrorMessage'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const debug = require('debug')('mssql');
const schema = require('./MsSqlConnector.schema');

/**
 * По каким-то, не до конца понятным, причинам error instaceof ConnectionError не cработал.  Этот метод реализаует
 * duck-typing для проверки что tedious вернул ошибку типа ConnectionError.
 */
const isConnectionError = (error) => error.__proto__.name === 'ConnectionError';

const SERVICE_TYPE = require('./MsSqlConnector.serviceType').SERVICE_TYPE;

export default oncePerServices(function (services) {

  const {bus = missingArgument('bus')} = services;

  class MsSqlConnector {

    _pool = null;

    constructor(settings) {
      schema.ctor_settings(this, settings);
      const {url, user, password, options, poolConfig} = settings;
      this._settings = settings;
      this._msSqlConfig = {server: url, userName: user, password, options};
      this._poolConfig = poolConfig;
    }

    _poolError = (error) => {
      if (this._service.state === READY) { // все ошибки пула, считаем критическими
        this._service.criticalFailure(error);
      }
    };

    async _serviceInit() {
      const settingsWithoutPassword = {...this._settings};
      delete settingsWithoutPassword.password;
      fixDependsOn(settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        settings: settingsWithoutPassword,
      });
    }

    async _servicePrestart() {
      this._pool = new ConnectionPool(this._poolConfig, this._msSqlConfig);
      this._pool.on('error', this._poolError);
    }

    async _serviceCheck() {
      try {
        await this._exec({ // вызываем private метод, чтоб не сработала защита что состояние не READY
          query: 'select getdate();',
          cancel: new Promise((resolve, reject) => {
            this._cancelCheck = resolve;
          })
        }); // проверка связи, любая ошибка означает что _serviceStart прошёл не успешно
      } finally {
        delete this._cancelCheck;
      }
    }

    _serviceIsCriticalError(error) {
      return error.code === 'ESCOKET'; // такая ошибка возникает после потери сетевого соединения
    }

    async _serviceStop() {
      if (this._cancelCheck) {
        this._cancelCheck();
        delete this._cancelCheck;
      }
      this._pool.drain();
      delete this._pool;
    }

    async connection(args) {
      schema.connection_args(args);
      let res = new Promise((resolve, reject) => {
        this._pool.acquire((error, connection) => {
          if (error) this._rejectWithError(reject, error);
          else resolve(new Connection(this, connection));
        });
      });
      if (args) {
        const {cancel} = args;
        if (cancel) { // если есть cancel promise, то когда соединение создается вешаем правило
          res = res.then(function (connection) {
            cancel.then(function () {
              res.cancel();
            });
            return connection;
          });
        }
      }
      return res;
    }

    /**
     * Выполняет запрос к БД.  Это может быть SQL запрос или вызов хранимой процедуры.
     *
     * Аргументы:
     *    - query - SQL запрос (Важно: Обязательно должен быть указан один из параметров query или procedure)
     *    - procedure - имя хранимой процедуры
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     */
    async exec(args) {
      let connection = await this._connection(args);
      try {
        return await connection._exec(args);
      }
      finally {
        connection._end();
      }
    }

    /**
     * Если это ConnectionError, то это означает что надо:
     * - перевести сервис в состояние FAILED
     * - вернуть ошибку InvalidServiceStateError
     *
     * Иначе, можно просто вернуть ошибку.
     */
    _rejectWithError(reject, error) {
      if (isConnectionError(error)) {
        if (this._service.get('state') === READY) this._service.criticalFailure(error);
        // ошибка связи во время выполнения запроса - возвращаем InvalidServiceStateError, так же как и когда заранее известно, что связи нет
        reject(this._service._buildInvalidStateError(error));
      }
      else reject(error);
    }
  }

  serviceMethodWrapper({
    prototypeOrInstance: MsSqlConnector.prototype, bus, getService: function () {
      return this._service;
    }
  });

  defineProps(MsSqlConnector, {
    msSqlConfig: {
      get: function () {
        return this._msSqlConfig;
      }
    },
    poolConfig: {
      get: function () {
        return this._poolConfig;
      }
    },
  });

  class Connection {

    constructor(connector, connection) {
      this._connector = connector;
      this._connection = connection;
    }

    /**
     * Выполняет запрос к БД.  Это может быть SQL запрос или вызов хранимой процедуры.
     *
     * Опции:
     *    - query - SQL запрос (Важно: Обязательно должен быть указан один из параметров query или procedure)
     *    - procedure - имя хранимой процедуры
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    exec(args) {
      return this._innerExec(args);
    }

    async _innerExec(args) {

      schema.exec_args(args);
      this._args = args;

      let {query, procedure, paramsDef, params, offset, limit} = args || {}; // TODO: Use call context in mssql call reports
      if (typeof offset !== 'number') offset = 0;
      if (typeof limit !== 'number') limit = Number.MAX_SAFE_INTEGER;
      const lastRow = Math.min(offset + limit, Number.MAX_SAFE_INTEGER);

      return new Promise((resolve, reject) => {

        let columns = null;
        let res = [];
        let hasNext = false;

        let request = new Request(query || procedure, (error, rowCount) => {
          if (error && error.code !== 'ECANCEL') {
            this._connector._rejectWithError(reject, error);
          } else {
            resolve({rows: res, hasNext, columns});
          }
        });

        if (params) {
          let paramName;
          try {
            for (paramName in params) {
              const paramValue = params[paramName];
              let tedType;
              if (paramsDef && hasOwnProperty.call(paramsDef, paramName)) {
                const def = paramsDef[paramName];
                if (typeof def === 'object') { // когда заданы дополнительные свойства
                  const {type, length, precision, scale} = def; // TODO: Добавить валидацию
                  if (!hasOwnProperty.call(stringToTediousTypeMap, type)) throw new Error(`Unknown type: ${prettyPrint(type)}`);
                  tedType = stringToTediousTypeMap[type];
                } else if (typeof def === 'string') {
                  if (!hasOwnProperty.call(stringToTediousTypeMap, def)) throw new Error(`Unknown type: ${prettyPrint(def)}`);
                  tedType = stringToTediousTypeMap[def];
                } else throw new Error(`Invalid parameter '${paramName}' definition: ${prettyPrint(def)}`);
              } else {
                tedType = tediouseTypeByValue(paramValue);
              }
              request.addParameter(paramName, tedType, paramValue);
            }
          }
          catch (error) {
            addPrefixToErrorMessage(`Parameter '${paramName}'`, error);
          }
        }

        let rowIndex = 0;
        request.on('columnMetadata', function (_columns) {
          columns = _columns;
        });
        request.on('row', function (columns) {
          debug('row %d', rowIndex);
          if (offset <= rowIndex && rowIndex < lastRow)
            res.push(copyRowData(columns));
          if (rowIndex == lastRow)
            if (!hasNext) { // это первая строка, после строки limit - завершаем процесс, и ставим hasNext = true
              debug('cancel request');
              hasNext = true;
            }
          rowIndex++;
        });

        // request.on('doneProc', function () {
        //   debug(`doneProc`);
        // });

        if (query)
          this._connection.execSql(request);
        else
          this._connection.callProcedure(request);
      });
    }

    end() {
      this._connection.release();
      this._connection = null;
    }
  }

  serviceMethodWrapper({
    prototypeOrInstance: Connection.prototype, bus, getService: function () {
      return this._connector._service;
    }
  });

  MsSqlConnector.SERVICE_TYPE = SERVICE_TYPE;

  return MsSqlConnector;
});

function copyRowData(columns) {
  let res = {};
  for (let c of columns) {
    res[c.metadata.colName.toLowerCase()] = c.value
  }
  return res
}
