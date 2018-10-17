import fs from 'fs'
import path from 'path'
import {missingArgument} from '../validation'
import {oncePerServices, missingService, fixDependsOn, READY} from '../services'
import ensureDir from '../utils/ensureDir'

import urlApi from 'url'
import soap from 'soap'
import SoapErrorException from '../errors/SoapErrorException'

const debug = require('debug')('soap');

const SERVICE_TYPE = require('./SoapConnector.serviceType').SERVICE_TYPE;
const schema = require('./SoapConnector.schema');

export default oncePerServices(function (services) {

  const {bus = missingService('bus')} = services;

  class Soap {

    constructor(options) {
      debug('ctor: %O', arguments);
      schema.config(options, {argument: 'options', copyTo: this});
      this._options = options;
      // TODO:  Привести к общему виду.  При переходе с задачи интеграции с 1С на интеграцию с МТС Connect, url -> uri, user -> login
      this._url = options.uri;
      this._user = options.login;
      this._httpUser = options.httpLogin;
    }

    _addMethods() {

      let client = this._connection;

      let desc = client.describe();
      let methods = null;

      // this._saveDescription(path.join(process.cwd(), './temp/soap')); // todo: fix crash at startup

      for (const serviceName of Object.getOwnPropertyNames(desc)) { // обрабатываем только первое описание - пока примеров нескольких описаний не было
        debug('service name: %s', serviceName);
        let service = desc[serviceName];
        for (const portName of Object.getOwnPropertyNames(service)) {
          debug('port name: %s', portName);
          if (portName.endsWith('12')) {
            methods = service[portName];
            break;
          }
        }
        break;
      }

      const url = this._url;
      for (const methodName of Object.getOwnPropertyNames(methods)) {
        debug('method: %s', methodName);
        let methodDesc = methods[methodName];
        this[methodName] = function (args) {
          debug('method: %s; args: %j', methodName, args);
          const service = this._service;
          if (service.state !== READY) throw this._service._buildInvalidStateError(); // та же логика, как то что добавляет services/serviceMethodWrapper
          return new Promise(function (resolve, reject) {
            client[methodName](args, function (err, result) {
              if (err) reject(new SoapErrorException({url, method: methodName, err}));
              else resolve(result);
            })
          }).catch((error) => {
            if (service.state !== READY) return Promise.rejected(this._service._buildInvalidStateError(error));
            return Promise.rejected(error);
          })
        }
      }
    }

    // TODO: Добавить проверку, что при очередном рестарте не поменялась схема - писать в bus как предупреждение
    // TODO: Удалять старые методы при restart

    async _serviceStart() {
      const optsWithoutPassword = {...this._options};
      delete optsWithoutPassword.password;
      fixDependsOn(optsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.get('name'),
        serviceType: SERVICE_TYPE,
        settings: optsWithoutPassword,
      });
      return new Promise((resolve, reject) => {
        let urlObject = urlApi.parse(this._url);
        let auth = null;
        
        let options = {};
        
        if(this._options && this._options.soapOptions) {
          options = {...this._options.soapOptions};
        }
        
        if (this._user) {
          urlObject.auth = `${this._user}:${this._password}`;
        }
        
        if (this._httpUser) {
          auth = "Basic " + new Buffer(`${this._httpUser}:${this._httpPassword}`).toString("base64");
          options.wsdl_headers = {Authorization: auth};
        }
        
        soap.createClient(`${urlApi.format(urlObject)}`, options, (err, client) => {
          if (err) {
            debug('client creation failed %O', err);
            reject(new SoapErrorException({url: this._url, method: 'createClient', err}));
          } else {
            debug(`client creation succeeded`);
            if (this._user) client.setSecurity(new soap.BasicAuthSecurity(this._user, this._password));
            if (this._httpUser) client.addHttpHeader('Authorization', auth); //http-авторизация
            
            this._connection = client;
            this._addMethods();
            resolve();
          }
        });
      });
    }

    async _serviceStop() {
      if (soap.reset) {
        soap.reset();
      }
    }

    async saveDescription(filename = missingArgument('filename')) {
      if (!this.hasOwnProperty('_client')) throw Error('Not initialized');
      let filenameNormolized = path.resolve(process.cwd(), filename);
      ensureDir(path.dirname(filenameNormolized));
      await Promise.promisify(fs.writeFile)(filenameNormolized, JSON.stringify(this._connection.describe(), null, 2));
    }
  }

  Soap.SERVICE_TYPE = SERVICE_TYPE;

  return Soap;
});
