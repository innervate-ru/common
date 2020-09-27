// код взят из hope/src/utils/_prettyPrint.coffee

import serializeError from 'serialize-error'

const MAX_LIST = 10;
const MAX_LEVELS = 2;
const MAX_STRING_LENGTH = 100;

function printList(list, maxLength, level, maxLevel) {
  var i, res;
  res = ((function() {
    var j, ref, results;
    results = [];
    for (i = j = 0, ref = Math.min(list.length, MAX_LIST); 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
      results.push(prettyPrint(list[i], maxLength, level, maxLevel));
    }
    return results;
  })()).join(', ');
  return "[" + res + (list.length > MAX_LIST ? ' ...]' : ']');
}

function printMap(map, maxLength, level, maxLevel) {
  var c, k, key, res, v, val;
  c = 0;
  res = ((function() {
    var results;
    results = [];
    for (k in map) {
      v = map[k];
      if (!(!k.startsWith('$'))) {
        continue;
      }
      if (!(c++ < MAX_LIST)) {
        break;
      }
      key = /^[\w_\$#\.]*$/g.test(k) ? "" + k : "'" + k + "'";
      val = prettyPrint(v, maxLength, level, maxLevel);
      results.push(key + ": " + val);
    }
    return results;
  })()).join(', ');
  return "{" + res + (c > MAX_LIST ? ' ...}' : '}');
}

export default function prettyPrint(arg, maxLength, level, maxLevel) {
  if (maxLength === undefined) maxLength = MAX_STRING_LENGTH;
  if (arg instanceof Error) {
    const err = serializeError(arg);
    delete err.stack;
    return prettyPrint(err, maxLength);
  } else if (typeof arg === 'object' && arg !== null) {
    level = level === undefined ? 0 : level + 1;
    if (level === (maxLevel || MAX_LEVELS)) {
      if (Array.isArray(arg)) {
        return `[list]`;
      } else {
        return `[object]`;
      }
    } else if (Array.isArray(arg)) {
      return printList(arg, maxLength, level, maxLevel);
    } else {
      return printMap(arg, maxLength, level, maxLevel);
    }
  } else if (typeof arg === 'string') {
    arg = arg.replace(/\r?\n|\r/g, ''); // Удаление переносов потребовалось, так как иначе, я так и не понял почему, не было видно причины ошибки, если это ошибка содержит stack с переносами
    if (arg.length > maxLength) arg = `${arg.substr(0, maxLength - 3)}...`; // ограничиваем длину выводимых.  полезно для Error.stack и для длинных JSON.
    return `'${arg}'`;
  } else if (typeof arg === 'function') {
    let functionAsString = arg.toString();
    if (functionAsString.length > maxLength) functionAsString = `${functionAsString.substr(0, maxLength - 3)}...`;
    return `'${functionAsString}'`;
  } else {
    return `${arg}`;
  }
}
