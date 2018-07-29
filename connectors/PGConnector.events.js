import {oncePerServices} from '../services'
import missingService from '../services/missingService'
import {STARTING} from '../services/Service.states'

const SERVICE_TYPE = require('./PGConnector.serviceType').SERVICE_TYPE;

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  bus.alterToString({

    // не выводим сообщение о STARTING, так как выводим OPTIONS.  иначе, не меняем стандартный вывод
    'service.state': ev => ev.serviceType !== SERVICE_TYPE && ev.state === STARTING ? undefined : false,

    'service.settings': ev => ev.serviceType !== SERVICE_TYPE ? false :
      `${ev.service}: connecting to ${ev.settings.host}:${ev.settings.port} as '${ev.settings.user}'. database is '${ev.settings.database}'`,
  });
})
