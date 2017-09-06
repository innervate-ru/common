import prettyPrint from './prettyPrint'

export function missingArgument(name, value) {
  throw new Error(`Missing argument '${name}'`);
}

export function invalidArgument(name, value) {
  throw new Error(`Invalid argument '${name}': ${prettyPrint(value)}`);
}
