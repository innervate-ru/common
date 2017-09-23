import oncePerServices from '../services/oncePerServices'

export default oncePerServices(function (services) {

  return async function ({parentLevelBuilder}) { // graphql builder

    parentLevelBuilder.setDescription('description: `Возвращает клиенту, список предпочитаемых локализаций из заголовка http-запроса`')

    parentLevelBuilder.addQuery({
      name: 'getAcceptLanguageFromHttpHeader',
      description: `Возврашает значение поля accept-language из заголовка http запроса`,
      args: `supportedLocales: String`,
      type: `String`,
      resolver: async function (obj, args, context) {
        const req = context.request;
        return req.headers && req.headers['accept-language'];
      }
    });
  }
})
