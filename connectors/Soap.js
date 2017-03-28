import * as fs from 'fs'
import path from 'path'

import ensureDir from 'ensure-dir'

import throwIfMissing from 'throw-if-missing'
import urlApi from 'url'
import soap from 'soap'
import SoapErrorException from '../errors/SoapErrorException'

const debug = require('debug')('soap');

/**
 * Интерфейс к 1C CRM.
 */
export default class Soap {

  constructor({url = throwIfMissing('url'), user, password}) {
    debug('ctor: %O', arguments);
    this._url = url;
    if (user) {
      this._user = user;
      this._password = password;
    }
  }

  _addMethods() {

    let client = this._client;

    let desc = client.describe();
    let methods = null;

    for (let serviceName in desc) {
      debug('service name: %s', serviceName);
      let service = desc[serviceName];
      for (let portName in service) {
        debug('port name: %s', portName);
        if (portName.endsWith('12')) {
          methods = service[portName];
          break;
        }
      }
      break;
    }

    let url = this._url;
    for (let methodName in methods) {
      debug('method: %s', methodName);
      let methodDesc = methods[methodName];
      this[methodName] = function(args) {
        debug('method: %s; args: %j', methodName, args);
        return new Promise(function (resolve, reject) {
          client[methodName](args, function (err, result) {
            if (err) reject(new SoapErrorException({url, action: methodName, err}));
            else resolve(result);
          })
        });
      }
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      let urlObject = urlApi.parse(this._url);
      if (this._user) urlObject.auth = `${this._user}:${this._password}`;
      soap.createClient(`${urlApi.format(urlObject)}?wsdl`, (err, client) => {
        if (err) {
          debug('client creation failed %O', err);
          reject(new SoapErrorException({url: this._poorUrl, method: 'createClient', err}));
        } else {
          debug(`client creation succeeded`);
          if (this._user) client.setSecurity(new soap.BasicAuthSecurity(this._user, this._password));
          this._client = client;
          this._addMethods();
          resolve();
        }
      });
    });
  }

  async saveDescription(filename = throwIfMissing('filename')) {
    if (!this.hasOwnProperty('_client')) throw Error('Not initialized');
    let filenameNormolized = path.resolve(process.cwd(), filename);
    ensureDir(path.dirname(filenameNormolized));
    await Promise.promisify(fs.writeFile)(filenameNormolized, JSON.stringify(this._client.describe(), null, 2));
  }
}
