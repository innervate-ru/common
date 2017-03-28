import configAPI from 'config'

import ConnectionPool from 'tedious-connection-pool'

export default function (dbName) {

  let config = configAPI.get(dbName);

  let pool = new ConnectionPool(config.poolConfig, {
    server: config.url,
    userName: config.user,
    password: config.password,
    database: config.database
  });

  pool.on('error', function(err) {
    console.error(`ConnectionPool ${err}`)
  });

  return pool;
}
