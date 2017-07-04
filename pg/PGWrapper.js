import throwIfMissing from 'throw-if-missing';

import pg from 'pg';

export default class PGWrapper {

  constructor(config = new throwIfMissing('config')) {
    this._pool = new pg.Pool(config);
    this._pool.on('error', function (err, client) {
      // TODO: Consider only catching a lost of connection to a database
      // console.error('idle client error', err.message, err.stack)
    });
  }

  async connection() {
    return new Promise((resolve, reject) => {
      this._pool.connect(function (err, client, done) {
        if (err) reject(err);
        else resolve(new Connection(client, done));
      });
    })
  }

  async query(statement = new throwIfMissing('statement'), args) {
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

  async end() {
    await this._pool.end();
  }
}

class Connection {

  constructor(client, done) {
    this._connection = client;
    this._done = done;
  }

  async query(statement = new throwIfMissing('statement'), args) {
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
