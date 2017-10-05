import {missingArgument, invalidArgument} from '../validation'
import prettyPrint from '../utils/prettyPrint'
import addServiceStateValidation from '../services/addServiceStateValidation'
import defineProps from '../utils/defineProps'
import oncePerServices from '../services/oncePerServices'
import ConnectionPool from 'tedious-connection-pool'
import {Request, ConnectionError} from 'tedious'
import {stringToTediousTypeMap, tediouseTypeByValue} from './MsSqlConnector.types'
import {READY} from '../services'
import addPrefixToErrorMessage from '../utils/addPrefixToErrorMessage'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const debug = require('debug')('mssql');
const schema = require('./MsSqlConnector.schema');

// TODO: + Передавать аргументы просто map'ом, и опция передавать типы отдельным map'ом
// TODO: Вместо того чтобы дергать отдельные методы, сделать просто метод exec, и передавать в него всё про запрос, включая context, чтоб это клалось в ошибки и логировкалось как параметры запроса
// TODO: Передавать контекст - сохранять в ошибке все параметры
// TODO: Добавить в ошибки тип запроса, параметры

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

    constructor(options) {

      schema.ctor_options(this, options);

      const {url, user, password, options: connectionOptions, poolConfig} = options;
      const {port, database} = options;

      this._options = options;

      this._msSqlConfig = {server: url, userName: user, password, options: connectionOptions};
      if (connectionOptions) this._msSqlConfig.options = connectionOptions;

      this._poolConfig = poolConfig;
    }

    _poolError = (error) => {
      // TODO: Проверить что сюда попадают ошибки от неправильных запросов
      if (this._service.state === READY)
        this._service.criticalFailure(error);
    };

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
      this._pool = new ConnectionPool(this._poolConfig, this._msSqlConfig);
      this._pool.on('error', this._poolError);
      return this._query('select getdate();', { // вызываем private метод, чтоб не сработала защита что состояние не READY
        cancel: new Promise((resolve, reject) => {
          this._cancelStart = resolve;
        })
      }); // проверка с  вязи, любая ошибка означает что _serviceStart прошёл не успешно
    }

    async _serviceStop() {
      return new Promise((resolve, reject) => {
        this._pool.drain(() => {
          this._pool = null;
          resolve();
        });
      });
    }

    async connection(options) {
      schema.connection_options(options);
      let res = new Promise((resolve, reject) => {
        this._pool.acquire((error, connection) => {
          if (error) this._rejectWithError(reject, error);
          else resolve(new Connection(this, connection));
        });
      });
      if (options) {
        const {cancel} = options;
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
     * Выполняет SQL запрос к БД.
     *
     * Опции:
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контектса
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param statement SQL запрос в строчном виде
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    // TODO: Obsolete
    async query(statement = missingArgument('statement'), options) {
      let connection = await this._connection(options); // TODO: Обработать ошибки
      try {
        return await connection._query(statement, options);
      }
      finally {
        connection._end();
      }
    }

    /**
     * Выполняет запрос к хранимой процедуре в БД.
     *
     * Опции:
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контектса
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param storedProcName Название хранимой процедуры
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    // TODO: Obsolete
    async callProcedure(storedProcName = missingArgument('storedProcName'), options) {
      let connection = await this._connection(options);
      try {
        return await connection._callProcedure(storedProcName, options);
      }
      finally {
        connection._end();
      }
    }

    /**
     * Выполняет запрос к хранимой процедуре в БД.
     *
     * Опции:
     *    - query - SQL запрос (Важно: Обязательно должен быть указан один из параметров query или procedure)
     *    - procedure - имя хранимой процедуры
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контекста, в котором выполняется запрос
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param storedProcName Название хранимой процедуры
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    async exec(options) {
      let connection = await this._connection(options);
      try {
        return await connection._exec(options);
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

  addServiceStateValidation(MsSqlConnector.prototype, function() { return this._service; });

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
     * Выполняет SQL запрос к БД.
     *
     * Опции:
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контектса
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param statement SQL запрос в строчном виде
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    // TODO: Obsolete
    query(statement = missingArgument('statement'), options) {
      if (!(typeof statement === 'string' && statement.length > 0)) invalidArgument('statement', statement);
      return this._innerExec({...options, query: statement});
    }

    /**
     * Выполняет запрос к хранимой процедуре в БД.
     *
     * Опции:
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контектса
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param storedProcName Название хранимой процедуры
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
     */
    // TODO: Obsolete
    callProcedure(storedProcName = missingArgument('storedProcName'), options) {
      if (!(typeof storedProcName === 'string' && storedProcName.length > 0)) invalidArgument('storedProcName', storedProcName);
      return this._innerExec({...options, procedure: storedProcName});
    }

    /**
     * Выполняет запрос к хранимой процедуре в БД.
     *
     * Опции:
     *    - query - SQL запрос (Важно: Обязательно должен быть указан один из параметров query или procedure)
     *    - procedure - имя хранимой процедуры
     *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
     *    - offset - строка, начиная с которой загружаются строки
     *    - limit - строка, до которой включительно загружаются строки
     *    - context - shortid контекста, в котором выполняется запрос
     *    - cancel - promise, который если становится resolved, то прерывает выполнение запроса
     *
     * @param options
     * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit; columns - методанные возвращаенных колонок}
     */
    exec(options) {
      return this._innerExec(options);
    }

    async _innerExec(options) {

      schema.query_options(options);
      this._options = options;

      let {query, procedure, paramsDef, params, offset, limit, context} = options || {};
      if (typeof offset !== 'number') offset = 0;
      if (typeof limit !== 'number') limit = Number.MAX_SAFE_INTEGER;
      const lastRow = Math.min(offset + limit, Number.MAX_SAFE_INTEGER);

      return new Promise((resolve, reject) => {

        let columns = null;
        let res = [];
        let hasNext = false;

        let request = new Request(query || procedure, (error, rowCount) => {
          if (error && error.code != 'ECANCEL') {
            error.callOptions = this._options;
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

  addServiceStateValidation(Connection.prototype, function() { return this._connector._service; });

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
