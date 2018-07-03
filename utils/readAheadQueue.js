import {missingArgument, invalidArgument} from './arguments'
import isPromise from 'is-promise'

const END_PROMISE = new Promise(function (resolve) {
  resolve(undefined);
});

/**
 * Keeps up to 'length' results of 'func' in the queue.  To be used in read-ahead tasks.
 *
 * While block is not returned, another next() must not be called.
 */
export default function readAheadQueue({
                                         context,
                                         func = missingArgument('func'),
                                         length = missingArgument('length'),
                                       }) {

  if (typeof func !== 'function') invalidArgument('func', func);
  if (typeof length !== 'number' && length > 0) invalidArgument('length', length);

  const queue = [];
  let theEnd = false;
  let prevPromise;

  return async function next({context}) {
    if (prevPromise && !prevPromise.isFulfilled()) {
      throw new Error(`Method next() can only be invoked once the previouse block was successfully received`);
    }
    console.info(30, queue.length)
    if (queue.length === 0) {
      if (theEnd) return;
      return prevPromise = loadNext({context});
    } else {
      queue.push(loadNext({context}));
      return prevPromise = queue.shift();
    }
  };

  /* async */
  function loadNext({context}) {
    if (theEnd) return END_PROMISE;
    return new Promise(function (resolve, reject) {
      const r = func({context});
      if (r === undefined) {
        theEnd = true;
        resolve(undefined);
      }
      if (!isPromise(r)) {
        reject(new Error(`'func' must return eitehr a Promise or undefined: ${r}`));
        return;
      }
      r.then((data) => {
        if (!data) { // the previous block was the last one
          theEnd = true;
          resolve(undefined);
        } else if (queue.length < length) {
          queue.push(loadNext({context}));
        }
        resolve(data); // Note: loadNext() MUST BE put in the queue prior to resolve() call.  Otherwise, could be raicing problems in the next() queue.length === 0 logic.
      }, (err) => {
        theEnd = true;
        reject(err);
      });
    });
  }
}
