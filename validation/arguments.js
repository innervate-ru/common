import prettyPrint from '../utils/prettyPrint'

export function _argError(reason, name, value) {
  new Error `${reason} '${name}': ${prettyPrint(value)}`
}

export function missingArgument(name) {
  throw new Error(`Missing argument '${name}'`);
}

export function invalidArgument(name, value) {
  throw new Error(`Invalid argument '${name}': ${prettyPrint(value)}`);
}

export function notEnoughArguments() {
  throw new Error `Not enough arguments`;
}

export function tooManyArguments() {
  throw new Error `Too many arguments`;
}

export function unknownOption(name) {
  throw new Error `Unknown option: '${name}'`;
}

export function missingRequiredOption(name) {
  throw new Error `Missing required option: '${name}'`;
}

export function invalidOption(name, value) {
  throw _argError(`Invalid option`, {name, value});
}

export function invalidProp(name) {
  throw new Error `Invalid property ${name}`;
}

export function invalidPropValue(name, value) {
  throw _argError(`Invalid value of propery`, {name, value});
}

export function reservedPropName(name, value) {
  throw _argError(`Reserved prop is used`, {name, value});
}

export function isResult(result) {
  return typeof result === 'object' && result != null && result.hasOwnProperty('isError');
}

export function checkResult(result) {
  if (!isResult(result)) {
    invalidArgument('result', result);
  }
}


