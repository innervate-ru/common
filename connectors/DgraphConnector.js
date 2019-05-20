import configAPI from 'config'
import oncePerServices from '../../common/services/oncePerServices'
import {missingService} from "../../common/services";
import defineProps from '../../common/utils/defineProps'

import * as dgraph from 'dgraph-js'
import * as grpc from 'grpc'
import * as dgraphAPI from "dgraph-js/lib/index";

const SERVICE_TYPE = require('./DgraphConnector.serviceType').SERVICE_TYPE;

export const name = require('../../common/services/serviceName').default(__filename);

const schema = require('./DgraphConnector.schema');

const KEEP_ALIVE_INTERVAL = 60 * 1000;

export default oncePerServices(function (services) {

  const {
    bus = missingService('bus'),
  } = services;

  class DgraphConnector {

    constructor(options) {
      schema.ctor_options(this, options);
    }

    async _serviceStart() {

      bus.info({
        type: 'service.settings',
        service: this._service.name,
        serviceType: SERVICE_TYPE,
        url: this._url,
        debug: this._debug,
      });

      this._clientStub = new dgraph.DgraphClientStub(this._url, grpc.credentials.createInsecure());
      this._client = new dgraph.DgraphClient(this._clientStub);
      this._client.setDebugMode(this._debug);

      try {
        await this._client.newTxn().query('{r(){}}');
      } catch (err) {
        delete err.metadata;
        throw err;
      }
      this._lastCall = Date.now();
      this._checkTimer = setInterval(() => {
        if ((Date.now() - this._lastCall) > KEEP_ALIVE_INTERVAL) {
          this._checkConnection();
        }
      }, KEEP_ALIVE_INTERVAL);
    }

    async _serviceStop() {
      clearInterval(this._checkTimer);
      this._clientStub.close();
      this._clientStub = null;
      this._client = null;
    }

    async _checkConnection() {
      try {
        this._lastCall = Date.now();
        await this._client.newTxn().query('{r(){}}');
      } catch (err) {
        delete err.metadata;
        this._service.criticalFailure(err);
      }
    }

    async txn({context, func}) {
      this._lastCall = Date.now();
      for (let i = 0; ; i++) {
        const txn = this._client.newTxn();
        try {
          return await func({context, txn});
        } catch (err) {
          await txn.discard();
          if (i === 5 || err !== dgraphAPI.ERR_ABORTED) {
            delete err.metadata;
            if (err.code === 14) { // UNAVAILABLE: Connect Failed
              this._service.criticalFailure(err);
            }
            throw err;
          }
        }
      }
    }
  }

  defineProps(DgraphConnector, {
    client: {
      get() {
        return this._client;
      }
    }
  });

  return DgraphConnector;
});
