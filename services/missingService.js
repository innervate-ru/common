import {missingArgument} from '../validation/arguments'

class MissingService extends Error {
  constructor(serviceName) {
    super(`Missing service '${serviceName}'`);
  }
}
MissingService.prototype.name = 'MissingService';

export default function missingService(serviceName = missingArgument('serviceName')) {
  throw new MissingService(serviceName);
}
