import throwIfMissing from 'throw-if-missing'

import ConnectionPool from 'tedious-connection-pool'
import MsSqlErrorException from '../errors/MsSqlErrorException'

const debug = require('debug')('mssql');

export default class MsSqlWrapper {

  constructor(config = new ThrowIfMissing('config')) {

    let {
      url = throwIfMissing('url'),
      user = throwIfMissing('user'),
      password = throwIfMissing('password'),
      options: {
        port = throwIfMissing('port'),
        database = throwIfMissing('database'),
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

  async query(statement = new ThrowIfMissing('statement'), args) {
    let connection = await this.connection();
    try {
      return await connection.query(statement, args);
    }
    finally {
      connection.done();
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

  async query(statement = new ThrowIfMissing('statement'), args) {

    let fromRow = args._fromRow || 0;
    let toRow = args._toRow || Number.MAX_SAFE_INTEGER;

    delete args._fromRow;
    delete args._toRow;

    return new Promise((resolve, reject) => {

      let res = [];
      let hasNext = false;

      this._connection.query(statement, args, function (err, results) {
        if (err && err.code != 'ECANCEL')
          reject(new MsSqlErrorException({err}));
        else {
          resolve({rows: res, hasNext});
        }
      });

      let rowIndex = 0;
      request.on('row', function (columns) {
        debug('row %d', rowIndex);
        if (fromRow <= rowIndex && rowIndex <= toRow)
          res.push(modifyColumns({model, columns}));
        if (rowIndex > toRow)
          if (!hasNext) { // это первая строка, после строки toRow - завершаем процесс, и ставим hasNext = true
            debug('cancel request');
            hasNext = true;
            checkColumns({model, res});
          }
        rowIndex++;
      });

      request.on('doneProc', function () {
        debug(`doneProc`);
      });

      this._connection.callProcedure(request);
    });
  }

  end() {
    this._connection.release();
    this._connection = null;
  }
}
