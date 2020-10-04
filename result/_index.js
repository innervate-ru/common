import {invalidArgument, notEnoughArguments, tooManyArguments} from '../validation/arguments'

function _add(index, path) {
  if (!(arguments.length > 0)) {
    notEnoughArguments();
  }
  if (typeof path !== 'string') {
    invalidArgument('path', name);
  }
  if (!(arguments.length <= 2)) {
    tooManyArguments();
  }
  path += `[${index}]`;
  return path; // _add =
}

export default function index(index, pathFunc) {
  if (!(arguments.length > 0)) {
    notEnoughArguments();
  }
  if (typeof index !== 'number') {
    invalidArgument('index', index);
  }
  if (!(arguments.length <= 2)) {
    tooManyArguments();
  }
  if (arguments.length === 1) {
    return function(path) {
      return _add(index, path);
    };
  }
  if (typeof pathFunc === 'function') {
    return function(path) {
      return _add(index, pathFunc(path));
    };
  }
  invalidArgument('pathFunc', pathFunc); // index =
}
