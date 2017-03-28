import throwIfMissing from 'throw-if-missing'

export default class InvalidServiceStateException extends Error {
  constructor({state = throwIfMissing('state')})
  {
    super(`Invalid service state: '${state.toString()}'`);
    this._state = state;
  }
}
