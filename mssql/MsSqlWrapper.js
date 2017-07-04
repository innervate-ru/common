import throwIfMissing from 'throw-if-missing'

import ConnectionPool from 'tedious-connection-pool'
import {Request} from 'tedious'

const debug = require('debug')('mssql');

export default class MsSqlWrapper {

  constructor(config = new throwIfMissing('config')) {

    const {
      url = throwIfMissing('url'),
      user = throwIfMissing('user'),
      password = throwIfMissing('password'),
      options: {
        port = throwIfMissing('port'),
        database = throwIfMissing('database'),
        ...otherOptions,
      },
      poolConfig = throwIfMissing('poolConfig'),
    } = config;

    this._msSqlConfig = {
      server: url,
      userName: user,
      password,
      options: {
        port,
        database,
        ...otherOptions,
      },
    };

    this._poolConfig = poolConfig;

    this._pool = new ConnectionPool(this._poolConfig, this._msSqlConfig);
  }

  async connection() {
    return new Promise((resolve, reject) => {
      this._pool.acquire(function (err, connection) {
        if (err) reject(err);
        else resolve(new Connection(connection));
      });
    });
  }

  async query(statement = new throwIfMissing('statement'), args) {
    let connection = await this.connection();
    try {
      return await connection.query(statement, args);
    }
    finally {
      connection.end();
    }
  }

  async end() {
    return new Promise((resolve, reject) => {
      this._pool.drain(function () {
        resolve();
      });
    });
  }
}

class Connection {

  constructor(connection) {
    this._connection = connection;
  }

  /**
   * Выполняет запрос к БД.
   *
   * Опции:
   *    - params - Функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
   *    - offset - строка, начиная с которой загружаются строки
   *    - limit - строка, до которой включительно загружаются строки
   *
   * @param statement SQL запрос в строчном виде
   * @param options Опции: params, offset, limit
   * @returns {Promise} {rows - полученные данные; hasNext - есть ли дальше строки, при указании limit}
   */
  async query(statement = new throwIfMissing('statement'), options) {

    let {params = null, offset = 0, limit = Number.MAX_SAFE_INTEGER} = options || {}

    return new Promise((resolve, reject) => {

      let columns = null;
      let res = [];
      let hasNext = false;

      let request = new Request(statement, function (err, rowCount) {
        if (err && err.code != 'ECANCEL')
          reject(err);
        else {
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

function copyRowData(columns) {
  let res = {};
  for (let c of columns) {
    res[c.metadata.colName.toLowerCase()] = c.value
  }
  return res
}
