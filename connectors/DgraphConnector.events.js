import {oncePerServices} from '../../common/services'
import missingService from '../../common/services/missingService'
import {STARTING} from '../../common/services/Service.states'

const SERVICE_TYPE = require('./DgraphConnector.serviceType').SERVICE_TYPE;

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  bus.alterToString({

    // не выводим сообщение о STARTING, так как выводим OPTIONS.  иначе, не меняем стандартный вывод
    'service.state': ev => ev.serviceType !== SERVICE_TYPE && ev.state === STARTING ? undefined : false,

    'service.settings': ev => ev.serviceType !== SERVICE_TYPE ? false :
      `${ev.service}: сonnecting to ${ev.url}.${ev.debug ? ' In DEBUG mode.' : ''}`,
  });
})
