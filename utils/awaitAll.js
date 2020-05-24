/**
 * Like Promise.all(), but awaits all promises and only then returns a result.  If any promise has failed, error of the first failed
 * promise will be returned.  If all promises succeeded, then copy of the argument array will be returned, with all promises
 * are replaced by resolve values.
 * @param promises
 * @returns {Promise<any>}
 */
function awaitAll(promises) {
  if (!Array.isArray(promises)) throw new Error(`Invalid argument 'promises': ${promises}`);
  let left = 0, isErr, err;
  return new Promise((resolve, reject) => {
    const res = promises.map((v, i) => {
      if (typeof v === 'object' && v !== null && typeof v.then === 'function') {
        left++;
        v.then(
          (data) => {
            res[i] = data;
            if (--left === 0) isErr ? reject(err) : resolve(res);
          },
          (_err) => {
            if (--left === 0) reject(isErr ? err : _err);
            else if (!isErr) {
              isErr = true;
              err = _err;
            }
          }
        );
      } else {
        return v;
      }
    });
    if (left === 0) resolve();
  });
}

module.exports = awaitAll;
module.exports.default = awaitAll;

