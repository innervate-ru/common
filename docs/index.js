import oncePerServices from '../services/oncePerServices'
import http from '../http'

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  class Docs {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._model = settings.model;
      this._postgres = settings.postgres;
    }

    @http({
      name: `create / update a document and/or perform an action`,
      result: true,
      http: true,
    })
    invoke = require('./_invoke').default(services);

    @http({
      name: `get a document by its type and id`,
      http: true,
    })
    get = require('./_get').default(services);

    @http({
      name: `list docs with given filter, order and paging`,
      http: true,
    })
    list = require('./_list').default(services);

    applyUserRights = require('./_applyUserRights').default(services);
  }

  return Docs;
});
