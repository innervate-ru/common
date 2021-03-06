// NOTE: Do not edit this file manually.  It's generated by the build task

import oncePerServices from '../../services/oncePerServices'

export default oncePerServices(function (services) {
  return {
    docs: {
      'doc.Doc1': {
        actions: {
            default: require('../model.test/docs/Doc1/systemActions.js').default?.(services),
            errorAction: require('../model.test/docs/Doc1/actions/errorAction.js').default?.(services),
            login: require('../model.test/docs/Doc1/actions/login.js').default?.(services),
            submit: require('../model.test/docs/Doc1/actions/submit.js').default?.(services),
        },
      },
      'doc.Doc2Computed': {
        computed: require('../model.test/docs/Doc2Computed/computed.js').default?.(services),
        actions: {
        },
      },
    },
    validators: require('../model.test/validators'),
  };
});