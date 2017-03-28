import throwIfMissing from 'throw-if-missing'

export default class UnexpectedResponseException extends Error {
  constructor({
    service = throwIfMissing('service'),
    method = throwIfMissing('method'),
    args,
    response = throwIfMissing('response'),
    exception})
  {
    super(`Unexpected response in service '${service}': ${method}(${JSON.stringify(args)})`);
    this._service = service;
    this._method = method;
    this._args = args;
    this._response = response;
    this._exception = exception;
  }
}
