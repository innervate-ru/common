// import buildFullErrorMessage from '../utils/buildFullErrorMessage'

export default function wrapResolver(resolver) {
  return resolver;
}

/**
 * Обертка для резолверов, чтоб возникающие в них ошибки выводились в консоль.  А то в graphQL приходит слишком мало
 * информации.
 */
// export default function wrapResolver(resolver) {
//   return function () {
//     return resolver.apply(null, arguments)
//     .catch(function (err) {
//       console.error(err);
//       const fullError = buildFullErrorMessage(err);
//       return Promise.rejected(fullError);
//     });
//   }
// }
