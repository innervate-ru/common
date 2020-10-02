import cloneDeep from 'lodash/cloneDeep'

import link from '../../../../lib/hope/lib/config/_link'
import oncePerServices from '../services/oncePerServices'

export const name = require('../services/serviceName').default(__filename);

export default oncePerServices(function (services) {

  const {
    postgres = missingService('postgres'),
  } = services;

  return new (require('../services/index').Service(services)(require('./index').default(services), {contextRequired: true}))(name, {
    model: link(cloneDeep(require('./data.test/model')), require('./data.test/model.server.code').default(services), {server: true}),
    postgres,
    dependsOn: [postgres]
  });
});
