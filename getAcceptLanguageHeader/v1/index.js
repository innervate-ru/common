import oncePerServices from '../../services/oncePerServices'
import LevelBuilder from '../../graphql/LevelBuilder'

export default oncePerServices(function (services) {

  return async function ({parentLevelBuilder}) { // graphql builder

    const localeBuilder = new LevelBuilder({name: `locale`, description: `Для списка поддерживаемых клиентом локализаций, возвращает наиболее подходящую.`});
    parentLevelBuilder.addBuilder(localeBuilder);

    localeBuilder.addQuery({
      name: '',
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
