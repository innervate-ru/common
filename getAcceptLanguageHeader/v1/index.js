import oncePerServices from '../../services/oncePerServices'
import acceptLanguage from 'accept-language'

export default oncePerServices(function (services) {

  return async function ({parentLevelBuilder}) { // graphql builder

    parentLevelBuilder.addQuery({
      name: 'supportedLocales',
      description: `Список locale, который поддреживает клиент`,
      type: `String!`,
      resolver: async function (obj, {supportedLocales}, context) {
        acceptLanguage.languages(supportedLocales);
        const locale = acceptLanguage.get(req.headers && req.headers['accept-language']);
        return {locale};
      }
    });
  }
})
