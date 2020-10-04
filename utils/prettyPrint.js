const MAX_LIST = 10;

const MAX_LEVELS = 2;

function printList(list, level, maxLevel) {
  const res = list.splice(0, Math.min(list.length, MAX_LIST)).map(v => prettyPrint(v, level, maxLevel)).join(', ');
  return `[${res}${list.length > MAX_LIST ? ' ...]' : ']'}`;
}

function printMap(map, level, maxLevel) {
  let c = 0;
  const res = Object.keys(map).reduce((acc, k) => {
    if (!k.startsWith('$') && ++c <= MAX_LIST) {
      const key = /^[\w_\$#\.]*$/g.test(k) ? `${k}` : `'${k}'`;
      const val = prettyPrint(map[k], level, maxLevel);
      acc.push(`${key}: ${val}`);
    }
    return acc;
  }, []).join(', ');
  return `{${res}${c > MAX_LIST ? ' ...}' : '}'}`;
}

export default function prettyPrint(arg, level, maxLevel) {
  if (typeof arg === 'object' && arg !== null) {
    level = level === void 0 ? 0 : level + 1;
    if (level === (maxLevel || MAX_LEVELS)) {
      if (Array.isArray(arg)) {
        return "[list]";
      } else {
        return "[object]";
      }
    } else if (Array.isArray(arg)) {
      return printList(arg, level, maxLevel);
    } else {
      return printMap(arg, level, maxLevel);
    }
  } else if (typeof arg === 'string') {
    return `'${arg}'`;
  } else {
    return `${arg}`;
  }
}
