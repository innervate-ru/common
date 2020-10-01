import {invalidArgument} from '../validation/arguments'

export default function httpAnnotation(...args) {
  const opts = {};
  function decorator(target, key, descriptor)  {
    (target || (target._http = {}))[key] = opts;
    return descriptor;
  }
  if (args.length === 1) { // decorator haa arguments
    const [options] = args;
    if (!(typeof options === 'object' && options !== null && !Array.isArray(options))) invalidArgument('options', options);
    if (options.result) opts.result = true;
    return decorator;
  }
  decorator.apply(undefined, args);
}
