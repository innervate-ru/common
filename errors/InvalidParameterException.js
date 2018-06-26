import {missingArgument} from '../utils/arguments'

export default class InvalidParameterException extends Error {
  constructor({
    url = missingArgument('url'),
    method = missingArgument('method'),
    args  = missingArgument('args'),
    exception})
  {
    super(`Invalid parameter in url '${url}': ${method} ${JSON.stringify(args)}`);
    this._url = url;
    this._method = method;
    this._args = args;
    this._exception = exception;
  }
}
