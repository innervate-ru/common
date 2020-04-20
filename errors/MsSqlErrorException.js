import {missingArgument} from '../validation/arguments'

export default class MsSqlErrorException extends Error {
  constructor({
                err = missingArgument('err')
              }) {

    super(`MSSQL error: err: ${err}`);
  }
}
