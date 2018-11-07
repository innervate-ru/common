import {missingArgument, invalidArgument} from '../utils/arguments'
import prettyPrint from '../utils/prettyPrint'
import {READY} from './Service.states'
import addContextToArgs from '../context/addContextToArgs'
import addContextToError from '../context/addContextToError'

/**
 * Все публичные методы данного класса оборачиваются проверкой, что сервис находится в состоянии READY.  Если это
 * основной класс сервиса, то
 *
 *
 */
export default function serviceMethodWrapper(prototypeOrInstance = missingArgument('prototypeOrInstance'), bus = missingArgument('bus'), getService = missingArgument('getService')) {
  if (!(typeof prototypeOrInstance === 'object' && prototypeOrInstance !== null && !Array.isArray(prototypeOrInstance))) invalidArgument('prototypeOrInstance', prototypeOrInstance);
  if (!(typeof getService === 'function')) invalidArgument('getService', getService);
  const methods = Object.getOwnPropertyNames(prototypeOrInstance);
  if (methods.indexOf('__serviceStateValidationAdded') >= 0) return; // уже обработанный класс
  for (const methodName of methods) {
    if (methodName === 'constructor') continue;
    if (!methodName.startsWith('_')) {
      let propType;
      try {
        propType = typeof prototypeOrInstance[methodName];
      } catch (error) {
        continue; // это может быть get метод, который сработал с ошибкой, так как this не верный
      }
      if (propType !== 'function') continue; // оборачиваем проверкой только методы, которые могли быть определены как методы класса, или через Object.defineProperties
      const privateMethodName = `_${methodName}`;
      if (privateMethodName in prototypeOrInstance)
        throw new Error(`Class ${prettyPrint(prototypeOrInstance)}: Already has private method ${privateMethodName}. This name is required to give not-restricted access to original method`);
      const method = prototypeOrInstance[methodName];
      prototypeOrInstance[privateMethodName] = method;

      prototypeOrInstance[methodName] = async function (args) {
        const newArgs = addContextToArgs(args);
        const service = getService.call(this);
        service.touch();
        if (service.state !== READY) { // проверяем состояние перед операции
          const error = service._buildInvalidStateError();
          if (addContextToError(args, newArgs, error, {service: service._name, method: methodName})) service._reportError(error);
          throw error;
        }
        const startTime = Date.now();
        try {
          const r = await Promise.resolve(method.call(this, newArgs));

          // Если прилетел буффер (файл), убираем его контент
          if(args && args.params) {
            Object.keys(args.params).map(paramKey => {
              if(Buffer.isBuffer(args.params[paramKey])) {
                args.params[paramKey] = `Buffer (length: ${Buffer.byteLength(args.params[paramKey])})`;
              }
            });
          }

          bus.method({
            type: 'service.method',
            service: service._name,
            method: methodName,
            context: newArgs.context,
            args: args,
            duration: Date.now() - startTime,
          });
          return r;
        } catch (error) {
          if (service.state !== READY)  error = service._buildInvalidStateError(error); // Проверяем состояние сервиса после операции, если ошибка.  Когда сервис не в рабочем состоянии, то не стоит анализировать ошибку
          if (addContextToError(args, newArgs, error, {service: service._name, method: methodName})) service._reportError(error);

          if(args && args.params) {
            Object.keys(args.params).map(paramKey => {
              if(Buffer.isBuffer(args.params[paramKey])) {
                args.params[paramKey] = `Buffer (length: ${Buffer.byteLength(args.params[paramKey])})`;
              }
            });
          }

          bus.method({
            type: 'service.method',
            service: service._name,
            method: methodName,
            context: newArgs.context,
            args: args,
            duration: Date.now() - startTime,
            failed: 1,
          });
          throw error;
        }

      }

    }
  }
  prototypeOrInstance.__serviceStateValidationAdded = true;
}
