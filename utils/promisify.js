/**
 * Method replicated functionality of bluebird Promise.promisify.  It's for the time, when due to problems on 'mac'
 * systems we are turning bluebird off.
 *
 * @param func
 * @returns {Function}
 */
export default function promisify(func, context) {
  return function() {
    let args = Array.prototype.slice.call(arguments);
    return new Promise(function (resolve, reject) {
      args.push(function (err, result) {
        if (err) reject(err);
        else resolve(result);
      });
      func.apply(context, args);
    });
  }
}
