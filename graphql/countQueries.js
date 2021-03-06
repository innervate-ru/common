import {missingArgument} from '../validation/arguments'

export default function(queries = missingArgument('queries')) {
  let cnt = 0;
  for (let key1 in queries) {
    let level2 = queries[key1];
    cnt += Object.keys(level2.type.getFields()).length; // предполагается, что все queries сделаны внутри namespace
  }
  return cnt;
}
