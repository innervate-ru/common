import fs from 'fs'
import path from 'path'
import {missingArgument} from '../validation'
import {oncePerServices, missingService, fixDependsOn, READY} from '../services'
import ensureDir from '../utils/ensureDir'
import promisify from '../utils/promisify'

import urlApi from 'url'
import * as soap from 'soap'
import SoapErrorException from '../errors/SoapErrorException'
import request from 'request-promise'

const debug = require('debug')('soap');

const SERVICE_TYPE = require('./SoapConnector.serviceType').SERVICE_TYPE;
const schema = require('./SoapConnector.schema');

export default oncePerServices(function (services) {

  const {bus = missingService('bus')} = services;

  class Soap {

    constructor(options) {
      debug('ctor: %O', arguments);
      schema.config(options, {argument: 'options'});
      this._options = options;
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

      for (const methodName of Object.getOwnPropertyNames(methods)) {
        debug('method: %s', methodName);
        const service = this._service;
        const method = client[methodName];

        this[methodName] = async function (args) {
          debug('method: %s; args: %j', methodName, args);

          let attempts = 1;

          while (true) {

            try {
              service._quickRestart && await service._quickRestart;
            } catch (error) {
              // ошибку не обрабатываем, так как при reject выполнится условие ниже service.state !== READY
            }

            if (service.state !== READY) { // проверяем состояние перед операции
              const error = service._buildInvalidStateError();
            }

            const startTime = Date.now();

            try {
              const r = await new Promise((resolve, reject) => {
                method(args, function (error, result) {
                  error ? reject(error) : resolve(result);
                });
              });

              const duration = Date.now() - startTime;

              const durationSec = duration / 1000;
              service._callAvgCounter(durationSec);
              service._callMaxCounter(durationSec);

              const evMethod = {
                type: 'service.method',
                service: service._name,
                method: methodName,
                // context: newArgs.context,
                args: arguments,
                duration,
              };
              if (attempts > 1) {
                evMethod.attempts = attempts;
              }
              bus.method(evMethod);

              return r;
            } catch (error) {
              if (service._quickRestart) {
                attempts++;
                continue; // если ошибка во время quick restart, повторяем попытку
              }

              if (service.state !== READY) { // проверяем состояние перед операции
                const error = service._buildInvalidStateError();
              }

              const isCriticalError = service._serviceIsCriticalError(error);
              if (!(typeof isCriticalError === 'boolean')) {
                service.criticalFailure(new Error(`service._serviceIsCriticalError returned not a boolean value: ${isCriticalError}`));
              } else if (isCriticalError) {
                service.criticalFailure(error);
              } else {
                service._reportError(error);
              }

              const duration = Date.now() - startTime;

              const durationSec = duration / 1000;
              service._callAvgCounter(durationSec);
              service._callMaxCounter(durationSec);

              const evMethod = {
                type: 'service.method',
                service: service._name,
                method: methodName,
                // context: newArgs.context,
                args: args,
                duration,
                failed: 1,
              };
              if (attempts > 1) {
                evMethod.attempts = attempts;
              }
              bus.method(evMethod);

              throw error;
            }
          }
        }
      }
    }

    _removeMethods() {
      for (const methodName of Object.getOwnPropertyNames(this)) {
        if (methodName === 'constructor') continue;
        if (!methodName.startsWith('_')) {
          delete this[methodName];
        }
      }
      delete this.__serviceStateValidationAdded;
    }

    // TODO: Добавить проверку, что при очередном рестарте не поменялась схема - писать в bus как предупреждение
    // TODO: Удалять старые методы при restart

    async _serviceCheck() {
      // TODO: zork: Запоминать схему, и рестартовать сервис если она поменялась
      const options = {
        mathod: 'GET',
        timeout: 20000,
        uri: this._options.uri,
      };
      if (this._options.httpLogin) {
        options.headers = {
          Authorization: "Basic " + new Buffer(`${this._options.httpLogin}:${this._options.httpPassword}`).toString("base64"),
        };
      }
      await request(options);
    }

    _serviceIsCriticalError(error) {
      return !!error && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED');
    }

    async _serviceStart() {
      const optsWithoutPassword = {...this._options};
      delete optsWithoutPassword.password;
      delete optsWithoutPassword.httpPassword;
      fixDependsOn(optsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.name,
        serviceType: SERVICE_TYPE,
        settings: optsWithoutPassword,
      });
      await new Promise((resolve, reject) => {
        let urlObject = urlApi.parse(this._options.uri);
        let auth = null;

        let options = {};

        if (this._options && this._options.soapOptions) {
          options = {...this._options.soapOptions};
        }

        if (this._options.login) {
          urlObject.auth = `${this._options.login}:${this._options.password}`;
        }

        if (this._options.httpLogin) {
          auth = "Basic " + new Buffer(`${this._options.httpLogin}:${this._options.httpPassword}`).toString("base64");
          options.wsdl_headers = {Authorization: auth};
        }

        soap.createClient(`${urlApi.format(urlObject)}`, options, (error, client) => {
          if (error) {
            debug('client creation failed %O', error);
            reject(new SoapErrorException({url: this._options.uri, method: 'createClient', error}));
          } else {
            debug(`client creation succeeded`);
            if (this._options.login) client.setSecurity(new soap.BasicAuthSecurity(this._options.login, this._options.password));
            if (this._options.httpLogin) client.addHttpHeader('Authorization', auth); // http-авторизация
            this._connection = client;
            this._addMethods();
            resolve();
          }
        });
      });
    }

    async _serviceStop() {
      delete this._connection;
      this._removeMethods();
    }

    async saveDescription(filename = missingArgument('filename')) {
      if (!this.hasOwnProperty('_client')) throw Error('Not initialized');
      const filenameNormalized = path.resolve(process.cwd(), filename);
      ensureDir(path.dirname(filenameNormalized));
      await promisify(fs.writeFile)(filenameNormalized, JSON.stringify(this._connection.describe(), null, 2));
    }
  }

  Soap.SERVICE_TYPE = SERVICE_TYPE;

  return Soap;
});
