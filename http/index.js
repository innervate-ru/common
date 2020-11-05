import {invalidArgument} from '../validation/arguments'

const schema = require('./index.schema');

export default function httpAnnotation(...args) {
  let opts = {};
  function decorator(target, key, descriptor)  {
    (target.__http || (target.__http = {}))[key] = opts;
    return descriptor;
  }
  if (args.length === 1) { // decorator has arguments
    opts = args[0];
    schema.args(opts);
    return decorator;
  }
  decorator.apply(undefined, args);
}
