import {invalidArgument, notEnoughArguments, tooManyArguments} from '../validation/arguments';

function _add(name, path) {
  if (!(arguments.length > 0)) {
    notEnoughArguments();
  }
  if (typeof path !== 'string') {
    invalidArgument('path', path);
  }
  if (!(arguments.length <= 2)) {
    tooManyArguments();
  }
  if (name.indexOf('.') >= 0) {
    path += `['${name}']`;
  } else {
    if (path.length > 0) {
      path += '.';
    }
    path += name;
  }
  return path;
}

export default function prop(name, pathFunc) {
  if (!(arguments.length > 0)) {
    notEnoughArguments();
  }
  if (!(typeof name === 'string' && name.length > 0)) {
    invalidArgument('name', name);
  }
  if (!(arguments.length <= 2)) {
    tooManyArguments();
  }
  if (arguments.length === 1) {
    return function(path) {
      return _add(name, path);
    };
  }
  if (typeof pathFunc === 'function') {
    return function(path) {
      return _add(name, pathFunc(path));
    };
  }
  invalidArgument('pathFunc', pathFunc);
};
