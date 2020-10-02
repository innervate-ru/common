import oncePerServices from '../services/oncePerServices'
import http from '../http'

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  return class Docs {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._model = settings.model;
      this._postgres = settings.postgres;
    }

    @http
    update = require('./_update').default(services);

    @http
    get = require('./_get').default(services);

    @http
    list = require('./_list').default(services);

    applyUserRights = require('./_applyUserRights').default(services);
  }
});
