import pmx from 'pmx'

/**
 * Обертка для резолверов, чтоб возникающие в них ошибки выводились в консоль.  А то в graphQL приходит слишком мало
 * информации.
 *
 * @param resolver
 * @returns {Function}
 */
export default function wrapResolver(resolver) {
  return function() {
    return resolver.apply(null, arguments).
    catch(function (err) {
      console.error(err);
      pmx.notify(err);
      return Promise.rejected(err);
    });
  }
}
