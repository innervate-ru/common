import throwIfMissing from 'throw-if-missingArgument'

export default class MsSqlErrorException extends Error {
  constructor({
    err = throwIfMissing('err')
  }) {

    super(`MSSQL error: err: ${err}`);
  }
}
