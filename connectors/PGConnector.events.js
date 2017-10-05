import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {STARTING} from '../services/Service.states'

const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  bus.alterToString({

    // не выводим сообщение о STARTING, так как выводим OPTIONS.  иначе, не меняем стандартный вывод
    'service.state': ev => ev.serviceType !== SERVICE_TYPE && ev.state === STARTING ? undefined : false,

    'service.options': ev => ev.serviceType !== SERVICE_TYPE ? false :
      `${ev.source}: сonnecting to ${ev.options.url}:${ev.options.port} as '${ev.options.user}'. database is '${ev.options.database}'`,
  });
})
