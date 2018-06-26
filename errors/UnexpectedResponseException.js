import {missingArgument} from '../utils/arguments'

export default class UnexpectedResponseException extends Error {
  constructor({
    service = missingArgument('service'),
    method = missingArgument('method'),
    args,
    response = missingArgument('response'),
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
