import throwIfMissing from 'throw-if-missing'

export default class InvalidServiceStateException extends Error {
  constructor({serviceName = throwIfMissing('serviceName'), state = throwIfMissing('state')})
  {
    super(`Invalid service state: '${state.toString()}'`);
    this.serviceName = serviceName;
    this.state = state;
  }
}
