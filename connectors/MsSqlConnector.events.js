import missingService from '../services/missingService'
import {STARTING} from '../services/Service.states'

export default function defineEvents({bus = missingService('bus')}) {

  const SERVICE_TYPE = require('./MsSqlConnector.serviceType').SERVICE_TYPE;

  bus.alterToString({

    // не выводим сообщение о STARTING, так как выводим OPTIONS.  иначе, не меняем стандартный вывод
    'service.state': ev => ev => ev.serviceType !== SERVICE_TYPE && ev.state === STARTING ? undefined : false,

    // выводим параметры запуска сервиса, с учётом специфики конфигурации это типа сервиса (serviceType)
    'service.options': ev => ev.serviceType !== SERVICE_TYPE ? false :
      `${ev.source}: сonnecting to ${ev.options.url}:${ev.options.options.port} as '${ev.options.user}'. database is '${ev.options.options.database}'`,

  });
}
