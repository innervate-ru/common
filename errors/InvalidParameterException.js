import throwIfMissing from 'throw-if-missing'

export default class InvalidParameterException extends Error {
  constructor({
    url = throwIfMissing('url'),
    method = throwIfMissing('method'),
    args  = throwIfMissing('args'),
    exception})
  {
    super(`Invalid parameter in url '${url}': ${method} ${JSON.stringify(args)}`);
    this._url = url;
    this._method = method;
    this._args = args;
    this._exception = exception;
  }
}
