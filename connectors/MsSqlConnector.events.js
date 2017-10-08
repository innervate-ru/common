import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {STARTING} from '../services/Service.states'

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  const SERVICE_TYPE = require('./MsSqlConnector.serviceType').SERVICE_TYPE;

  bus.alterToString({

    // не выводим сообщение о STARTING, так как выводим OPTIONS.  иначе, не меняем стандартный вывод
    'service.state': ev => ev.serviceType !== SERVICE_TYPE && ev.state === STARTING ? undefined : false,

    // выводим параметры запуска сервиса, с учётом специфики конфигурации это типа сервиса (serviceType)
    'service.settings': ev => ev.serviceType !== SERVICE_TYPE ? false :
      `${ev.source}: сonnecting to ${ev.settings.url}:${ev.settings.options.port} as '${ev.settings.user}'. database is '${ev.settings.options.database}'`,

  });
})
