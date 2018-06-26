import {missingArgument} from '../utils/arguments'

export default class InvalidServiceStateException extends Error {
  constructor({state = missingArgument('state')})
  {
    super(`Invalid service state: '${state.toString()}'`);
    this._state = state;
  }
}
