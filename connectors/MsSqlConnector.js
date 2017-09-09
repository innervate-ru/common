import throwIfMissing from 'throw-if-missing'
import prettyPrint from '../utils/prettyPrint'
import defineProps from '../utils/defineProps'
import {
  validateAndCopyOptionsFactory,
  validateArgumentNameOptions,
  VType,
} from '../validation'

import ConnectionPool from 'tedious-connection-pool'
import {Request, ConnectionError} from 'tedious'

import {STARTING, READY} from '../services'

const debug = require('debug')('mssql');

/**
 * По каким-то, не до конца понятным, причинам error instaceof ConnectionError не cработал.  Этот метод реализаует
 * duck-typing для проверки что tedious вернул ошибку типа ConnectionError.
 */
const isConnectionError = (error) => error.__proto__.name === 'ConnectionError';

const validateOptionsOptions = validateAndCopyOptionsFactory({
  appName: {type: VType.String().notEmpty()},
  debug: {type: VType.Int()},
  port: {type: VType.Int()},
  database: {type: VType.String().notEmpty(), required: true},
});

const validatePoolConfig = validateAndCopyOptionsFactory({
  min: {type: VType.Int().positive()},
  max: {type: VType.Int().positive()},
  log: {type: VType.Bool()},
  idleTimeout: {type: VType.Int().positive()},
  retryDelay: {type: VType.Int().positive()},
  acquireTimeout: {type: VType.Int().positive()},
});

const validateOptions = validateAndCopyOptionsFactory({
  description: {type: VType.String()},
  url: {type: VType.String().notEmpty(), required: true},
  user: {type: VType.String().notEmpty(), required: true},
  password: {type: VType.String().notEmpty(), required: true},
  options: {
    fields: {
      appName: {type: VType.String().notEmpty()},
      debug: {type: VType.Int()},
      port: {type: VType.Int()},
      database: {type: VType.String().notEmpty(), required: true},
    },
  },
  poolConfig: {
    fields: {
      min: {type: VType.Int().positive()},
      max: {type: VType.Int().positive()},
      log: {type: VType.Bool()},
      idleTimeout: {type: VType.Int().positive()},
      retryDelay: {type: VType.Int().positive()},
      acquireTimeout: {type: VType.Int().positive()},
    },
  },
});

export function config(services) {
  // nothing
}

const validateConnectionOptions = validateAndCopyOptionsFactory({
  cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
});

export default function (services) {

  const {bus = throwIfMissing('bus')} = services;

  class MsSqlConnector {

    _pool = null;

    constructor(options) {

      validateOptions(options, validateArgumentNameOptions);

      const {url, user, password, options: connectionOptions, poolConfig} = options;
      const {port, database} = options;

      this._options = options;

      this._msSqlConfig = {server: url, userName: user, password, options: connectionOptions};
      if (connectionOptions) this._msSqlConfig.options = connectionOptions;

      this._poolConfig = poolConfig;
    }

    _poolError = (error) => {
      // TODO: Проверить что сюда попадают ошибки от неправильных запросов
      console.info('error');
      if (this._service.state === READY)
        this._service.criticalFailure(error);
    };

    async _serviceStart() {
      bus.info({
        time: new Date().getTime(),
        type: 'service.options',
        source: this._service.get('name'),
        options: this._options,
      });
      this._pool = new ConnectionPool(this._poolConfig, this._msSqlConfig);
      this._pool.on('error', this._poolError);
      return this.query('select getdate();', {
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
      validateConnectionOptions(options, validateArgumentNameOptions);
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
     * Выполняет запрос к БД.
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
    async query(statement = throwIfMissing('statement'), options) {
      let connection = await this.connection(options);
      try {
        return await connection.query(statement, options);
      }
      finally {
        connection.end();
      }
    }

    /**
     * Если это ConnectionError, то это означает что надо:
     * - перевести сервис в состояние FAILED
     * - вернуть ошибку InvalidStateError
     *
     * Иначе, можно просто вернуть ошибку.
     */
    _rejectWithError(reject, error) {
      if (isConnectionError(error)) {
        if (this._service.get('state') === READY) this._service.criticalFailure(error);
        // ошибка связи во время выполнения запроса - возвращаем InvalidStateError, так же как и когда заранее известно, что связи нет
        reject(this._service._buildInvalidStateError(error));
      }
      else reject(error);

    }
  }

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

  const validateQueryOptions = validateAndCopyOptionsFactory({
    params: {type: VType.Function()}, // функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
    offset: {type: VType.Int().zero().positive()}, // строка, начиная с которой загружаются строки
    limit: {type: VType.Int().positive()}, // строка, до которой включительно загружаются строки
    context: {type: VType.String().notEmpty()}, // shortid контектса
  });

  class Connection {

    constructor(connector, connection) {
      this._connector = connector;
      this._connection = connection;
    }

    /**
     * Выполняет запрос к БД.
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
    async query(statement = throwIfMissing('statement'), options) {

      if (!(typeof statement === 'string' && statement.length > 0))  throw new Error(`Invalid argument 'statement': ${prettyPrint(statement)}`);
      validateQueryOptions(options, validateArgumentNameOptions);

      const {params = null, offset = 0, limit = Number.MAX_SAFE_INTEGER, context} = options || {};

      return new Promise((resolve, reject) => {

        let columns = null;
        let res = [];
        let hasNext = false;

        let request = new Request(statement, (error, rowCount) => {
          if (error && error.code != 'ECANCEL') {
            this._connector._rejectWithError(reject, error);
          } else {
            resolve({rows: res, hasNext, columns});
          }
        });

        if (params) params(request);

        let rowIndex = 0;
        request.on('columnMetadata', function (_columns) {
          columns = _columns;
        });
        request.on('row', function (columns) {
          debug('row %d', rowIndex);
          if (offset <= rowIndex && rowIndex <= limit)
            res.push(copyRowData(columns));
          if (rowIndex > limit)
            if (!hasNext) { // это первая строка, после строки limit - завершаем процесс, и ставим hasNext = true
              debug('cancel request');
              hasNext = true;
            }
          rowIndex++;
        });

        // request.on('doneProc', function () {
        //   debug(`doneProc`);
        // });

        this._connection.execSql(request);
      });
    }

    end() {
      this._connection.release();
      this._connection = null;
    }
  }

  return MsSqlConnector;
}

function copyRowData(columns) {
  let res = {};
  for (let c of columns) {
    res[c.metadata.colName.toLowerCase()] = c.value
  }
  return res
}
