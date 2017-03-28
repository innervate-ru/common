import throwIfMissing from 'throw-if-missing'

export default class SoapErrorException extends Error {
  constructor({url = throwIfMissing('url'), method = throwIfMissing('method'), err = throwIfMissing('err')}) {
    super(`SOAP error: url: ${url}; action: ${method}; err: ${err}`);
  }
}
