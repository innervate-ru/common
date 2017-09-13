import missingArgument from '../utils/arguments'

export default class SoapErrorException extends Error {
  constructor({url = missingArgument('url'), method = missingArgument('method'), err = missingArgument('err')}) {
    super(`SOAP error: url: ${url}; action: ${method}; err: ${err}`);
  }
}
