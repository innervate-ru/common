const schema = require('./index.schema');

export default function httpAnnotation(...args) {
  let opts = {};
  function decorator(target, key, descriptor)  {
    if (key) { // method
      (target.__http || (target.__http = {}))[key] = opts;
    } else { // class
      target.__http = opts;
      (target.prototype.__http || (target.prototype.__http = {}))[''] = opts;
    }
    return descriptor;
  }
  if (args.length === 1 && typeof args[0] !== 'function') { // decorator has arguments
    opts = args[0];
    schema.args(opts);
    return decorator;
  }
  decorator.apply(undefined, args);
}
