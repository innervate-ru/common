import tedious from 'tedious'
import throwIfMissing from 'throw-if-missing'
import ConnectionPool from 'tedious-connection-pool'
import MsSqlErrorException from '../errors/MsSqlErrorException'
import InvalidParameterException from '../errors/InvalidParameterException'
import Service from '../Service'

const TYPES = tedious.TYPES;

const debug = require('debug')('mssql');

/**
 * Интерфейс MSSQL.
 */
export default class MsSql extends Service {

  _addMethod(model) {
    let self = this;
    let pool = this._pool;
    let methodName = model.name;
    this[methodName] = (args) => {
      // args._maxRows - параметр для ограничения количества забираемых строк

      super._checkState();

      debug('method: %s; args: %j', methodName, args);
      return new Promise(function (resolve, reject) {

        let maxRows = null;
        // перекладываем maxRows в переменную и удаляем из args (иначе не проходит проверку на соответствие аргументов модели)
        let fromRow = args._fromRow || 0;
        let toRow = args._toRow || Number.MAX_SAFE_INTEGER;

        delete args._fromRow;
        delete args._toRow;

        // проверка аргументов
        let errMsg = checkMethodArgs({model, args});
        if (errMsg.length > 0) {
          reject(new InvalidParameterException({url: self._msSqlConfig.server, method: methodName, args: errMsg}));
          return
        }

        let res = [];
        let hasNext = false;

        pool.acquire(function (err, connection) {

          let request = new tedious.Request(model.name, function (err, rowCount) {
            if (err && err.code != 'ECANCEL')
              reject(new MsSqlErrorException({err}));
            else {
              checkColumns({model, res});
              connection.release();
              resolve({rows: res, hasNext});
            }
          });

          addParamsToRequest({request, model, args});

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
                // connection.cancel();
              }
            rowIndex++;
          });

          request.on('doneProc', function() {
            debug(`doneProc`);
          });

          connection.callProcedure(request);
        });
      })
    }
  }

  async _init({
    url = throwIfMissing('url'),
    port = throwIfMissing('port'),
    user = throwIfMissing('user'),
    password = throwIfMissing('password'),
    database = throwIfMissing('database'),
    poolConfig = throwIfMissing('poolConfig'),
    schema = throwIfMissing('schema'),
  }) {
    this._msSqlConfig = {
      server: url,
      userName: user,
      password,
      database,
      port
    };
    this._poolConfig = poolConfig;
    this._schema = schema;

    await new Promise((resolve, reject) => {
      this._pool = new ConnectionPool(this._poolConfig, this._msSqlConfig);
      for (let s of this._schema) {
        this._addMethod(s)
      }
      resolve();
    });

    super._init();

    console.info(`MS SQL: Connected to ${url}:${port} as '${user}'. Database is '${database}'.`);
  }
}

function checkMethodArgs({model, args}) {
  let wrongParams = [];
  let wrongTypes = [];
  let requiredParams = []
  let msg = '';
  // проверка аргументов
  for (let a in args) {
    let isFound = false;
    for (let m of model.params) {
      if (m.name == a) {
        // проверка наличия переданного параметра в метамодели
        isFound = true;
        // проверка типа параметра
        switch (m.type) {
          case 'string':
            if (!(typeof args[a] === 'string' || args[a] === null))
              wrongTypes.push(`Param '${a}' has wrong type: ${typeof args[a]}'. Must be 'string'`);
            break;
          default:
            wrongTypes.push(`Param '${a} unknown type: ${m.type}'`);
            break
        }
        break
      }
    }
    if (!isFound) wrongParams.push(a);
  }

  // проверка наличия обязательных параметров
  for (let m of model.params) {
    if (m.required) {
      if (!args.hasOwnProperty(m.name)) {
        if (m.hasOwnProperty('default'))
          args[m.name] = m.default;
        else requiredParams.push(`Missing required param '${m.name}'`)
      }
    }
  }

  if (wrongParams.length > 0) msg += `Wrong params: ${wrongParams.join(', ')}. `;
  if (wrongTypes.length > 0) msg += wrongTypes.join(', ');
  if (requiredParams.length > 0) msg += requiredParams.join(', ');

  return msg
}

/**
 *
 * @param request - объект tedious request
 * @param model - описание модели
 * @param args - аргументы вызова процедуры
 */
function addParamsToRequest({
  request = throwIfMissing('request'),
  model = throwIfMissing('model'),
  args = throwIfMissing('args'),
}) {
  for (let val in args) {
    request.addParameter(val, getMsSqlTypeFromModel(val, model), args[val]);
    //debug('request to mssql: %O;', request);
  }
}

function getMsSqlTypeFromModel(name, model) {
  for (let m of model.params) {
    if (name == m.name) {
      if (m.mssqlType) return TYPES[m.mssqlType];
      switch (m.type) {
        case 'string':
          return TYPES.VarChar;
          break;
        case 'int':
          return TYPES.Int;
          break;
        case 'float':
          return TYPES.Float;
          break;
        default:
          throwIfMissing(`uknown tedious type for type '${m.type}'`)
      }
    }
  }
}

function modifyColumns({columns}) {
  let res = {};
  for (let c of columns) {
    res[c.metadata.colName.toLowerCase()] = c.value
  }
  return res
}

function checkColumns({model, res}) {
  if (res[0]) {
    for (let c in res[0]) {
      let notFound = true;
      for (let m of model.fldsOut) {
        if (m.name === c.toLowerCase()) {
          notFound = false;
          break
        }
      }
      if (notFound) console.log(`WARNING: New field in method '${model.name}': '${c}'. You must make a change to the model`)
    }
  }
}
