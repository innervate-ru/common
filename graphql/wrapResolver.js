import serializeError from 'serialize-error'
import pmx from 'pmx'

/**
 * Обертка для резолверов, чтоб возникающие в них ошибки выводились в консоль.  А то в graphQL приходит слишком мало
 * информации.
 *
 * @param resolver
 * @returns {Function}
 */
export default function wrapResolver(resolver) {
  return function () {
    return resolver.apply(null, arguments)
      .catch(function (err) {
        console.error(err);
        pmx.notify(err);

        // для GraphQL передаем ошибку, где в message в json есть все поля исходной ошибки, кроме stack
        const v = serializeError(err);
        console.info('v', v);
        if (typeof err.name == 'string') v.name = err.name;
        delete v.stack;
        return Promise.rejected(new Error(JSON.stringify(v)));
      });
  }
}
