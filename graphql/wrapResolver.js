/**
 * Обертка для резолверов, чтоб возникающие в них ошибки выводились в консоль.  А то в graphQL приходит слишком мало
 * информации.
 *
 * @param resolver
 * @returns {Function}
 */
export default function wrapResolver(resolver) {
  return function() {
    let args = arguments;
    return new Promise(function (resolve, reject) {
      try {
        resolve(resolver.apply(null, args));
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  }
}
