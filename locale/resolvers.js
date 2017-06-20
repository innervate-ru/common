import wrapResolver from '../graphql/wrapResolver'
import acceptLanguage from 'accept-language'

async function selectLocale({supportedLocales}, req) {
  acceptLanguage.languages(supportedLocales);
  const locale = acceptLanguage.get(req.headers && req.headers['accept-language']);
  return {locale};
}

/**
 * Добавляет resolver для graphql запросов и мутаций.
 * @param root
 */
export default function (root) {
  root.locale = {
    selectLocale: wrapResolver(selectLocale),
  };
}
