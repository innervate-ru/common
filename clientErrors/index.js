import {oncePerServices, missingService} from "../services";
import http from '../http'
import requestByContext from '../context/requestByContext'

export const name = 'clientErrors';

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus,
  } = services;

  class ClientErrors {

    @http({name: `Log client errors`})
    log(args) {
      schema.log_args(args);
      const req = requestByContext(args.context);
      bus.error({
        ...(() => {
          if (req.user) {
            const {id, ...rest} = req.user;
            return rest;
          }
        })(),
        context: args.context,
        type: 'client.error',
        service: name,
        userAgent: req.get('user-agent'),
        error: args.error,
        session: req.session,
      });
    }
  }

  return new (require('../services').Service(services)(ClientErrors, {contextRequired: true}))(name);
});
