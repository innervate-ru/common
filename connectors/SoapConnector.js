import fs from 'fs'
import path from 'path'
import {missingArgument} from '../validation'
import {oncePerServices, missingService, fixDependsOn, READY} from '../services'
import ensureDir from '../utils/ensureDir'
import {promisify} from 'util'

import urlApi from 'url'
import * as soap from 'soap'
import SoapErrorException from '../errors/SoapErrorException'
import request from 'request-promise'
import addContextToError from '../context/addContextToError'
import addContextToArgs from '../context/addContextToArgs'
import requestByContext from '../context/requestByContext'
import errorDataToEvent from '../errors/errorDataToEvent'

const debug = require('debug')('soap');

const SERVICE_TYPE = require('./SoapConnector.serviceType').SERVICE_TYPE;
const schema = require('./SoapConnector.schema');

export default oncePerServices(function (services) {

  const {bus = missingService('bus')} = services;

  class Soap {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._logResult = !!settings?.logResult;
      this._settings = settings;
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

      this._soapMethods = methods;

      for (const methodName of Object.getOwnPropertyNames(methods)) {
        debug('method: %s', methodName);
        const service = this._service;
        const contextRequired = service._contextRequired;
        const method = client[methodName];

        const fixArgs = this._fixArgsBuilder ? this._fixArgsBuilder({methodName}) : function (args) {
          const {context, ...rest} = args;
          return rest;
        };
        const fixResult = this._fixResultBuilder ? this._fixResultBuilder({methodName}) : function (result) {
          return result;
        };

        this[methodName] = async (args) => {
          debug('method: %s; args: %j', methodName, args);

          if (contextRequired) {
            if (!(args && typeof args.context === 'string' && args.context.length > 0)) {
              missingArgument('context');
            }
          }

          const user = args.user;

          let attempts = 1;

          while (true) {

            try {
              service._quickRestart && await service._quickRestart;
            } catch (error) {
              // ошибку не обрабатываем, так как при reject выполнится условие ниже service.state !== READY
            }

            const newArgs = addContextToArgs(args);

            if (service.state !== READY) { // проверяем состояние перед операцией
              const error = service._buildInvalidStateError();
              if (addContextToError(args, newArgs, error, {
                service: service._name,
                method: methodName
              })) service._reportError(error);
              throw error;
            }

            const startTime = Date.now();

            const fixedArgs = fixArgs(newArgs);

            try {
              const r = await new Promise((resolve, reject) => {
                method(fixedArgs, function (error, result) {
                  error ? reject(error) : resolve(fixResult(result, newArgs.context));
                });
              });

              const duration = Date.now() - startTime;

              const durationSec = duration / 1000;
              service._callAvgCounter(durationSec);
              service._callMaxCounter(durationSec);

              const evMethod = {
                context: newArgs.context,
                type: 'service.method',
                service: service._name,
                method: methodName,
                args: fixedArgs,
                duration,
              };
              if (attempts > 1) {
                evMethod.attempts = attempts;
              }

              if (!this._logResult) {
                bus.method(evMethod);
              } else {
                evMethod.type = 'service.method.result';
                // evMethod.result = r;
                evMethod.action = methodName;
                evMethod.context = newArgs.context;
                const request = requestByContext(newArgs.context);
                if (request) {
                  if (request.user) {
                    evMethod.username = request.user.login;
                    evMethod.email = request.user.email;
                    evMethod.client = request.user.crmId;
                  }
                  evMethod.userIp = request.userIp;
                }
                bus.event(evMethod);
              }

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
                context: newArgs.context,
                type: 'service.method',
                service: service._name,
                method: methodName,
                args: args,
                duration,
                failed: 1,
              };
              if (attempts > 1) {
                evMethod.attempts = attempts;
              }
              if (!this._logResult) {
                bus.method(evMethod);
              } else {
                errorDataToEvent(error, evMethod);
                evMethod.type = 'service.method.result';
                evMethod.action = methodName;
                evMethod.context = newArgs.context;
                const request = requestByContext(newArgs.context);
                if (request) {
                  this._requestToEvent?.(evMethod, request);
                  evMethod.userIp = request.userIp;
                }
                bus.event(evMethod);
              }

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
        uri: this._settings.uri,
      };
      if (this._settings.httpLogin) {
        options.headers = {
          Authorization: "Basic " + Buffer.from(`${this._settings.httpLogin}:${this._settings.httpPassword}`).toString("base64"),
        };
      }
      if (this._settings.token) {
        options.headers = {
          Authorization: `Bearer ${this._settings.token}`,
        };
      }
      await request(options);
    }

    _serviceIsCriticalError(error) {
      return !!error && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED');
    }

    async _serviceInit() {
      const optsWithoutPassword = {...this._settings};
      delete optsWithoutPassword.token;
      delete optsWithoutPassword.password;
      delete optsWithoutPassword.httpPassword;
      fixDependsOn(optsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: this._service.name,
        serviceType: SERVICE_TYPE,
        settings: optsWithoutPassword,
      });
    }

    async _serviceStart() {
      await new Promise((resolve, reject) => {
        let urlObject = urlApi.parse(this._settings.uri);
        let auth = null;

        let options = {};

        if (this._settings && this._settings.soapOptions) {
          options = {...this._settings.soapOptions};
        }

        if (this._settings.login) {
          urlObject.auth = `${this._settings.login}:${this._settings.password}`;
        }

        if (this._settings.httpLogin) {
          auth = "Basic " + Buffer.from(`${this._settings.httpLogin}:${this._settings.httpPassword}`).toString("base64");
          options.wsdl_headers = {Authorization: auth};
        }

        if (this._settings.token) {
          auth = `Bearer ${this._settings.token}`;
        }

        soap.createClient(`${urlApi.format(urlObject)}`, options, (error, client) => {
          if (error) {
            debug('client creation failed %O', error);
            reject(new SoapErrorException({url: this._settings.uri, method: 'createClient', error}));
          } else {
            debug(`client creation succeeded`);
            if (debug.enabled) {
              // client.on('request', (xml, eid) => {
              //   debug(`.on('request', %s, %s)`, xml, eid);
              // });
              client.on('message', (message, eid) => {
                debug(`.on('message', %s, %s)`, message, eid);
              });
              client.on('soapError', (error, eid) => {
                debug(`.on('soapError', %s, %s)`, error, eid);
              });
              // client.on('response', (body, response, eid) => {
              //   debug(`.on('response', %s, %s, %s)`, body, response, eid);
              // });
            }
            if (this._settings.login) client.setSecurity(new soap.BasicAuthSecurity(this._settings.login, this._settings.password));
            if (auth) client.addHttpHeader('Authorization', auth); // http-авторизация
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
