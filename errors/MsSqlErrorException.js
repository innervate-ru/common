import throwIfMissing from 'throw-if-missing'
import serializeError from 'serialize-error'

export default class MsSqlErrorException extends Error {
  constructor({
    err = throwIfMissing('err')
  }) {

    super(`MSSQL error: err: ${err}`);
  }
}
