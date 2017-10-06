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
export default function addServiceStateValidation(prototypeOrInstance = missingArgument('prototypeOrInstance'), getService = missingArgument('getService')) {
  if (!(typeof prototypeOrInstance === 'object' && prototypeOrInstance != null && !Array.isArray(prototypeOrInstance))) invalidArgument('prototypeOrInstance', prototypeOrInstance);
  if (!(typeof getService === 'function')) invalidArgument('getService', getService);
  if ('__serviceStateValidationAdded' in prototypeOrInstance) return; // уже обработанный класс
  for (const methodName of Object.getOwnPropertyNames(prototypeOrInstance)) {
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

      prototypeOrInstance[methodName] = function (args) {
        const newArgs = addContextToArgs(args);
        const service = getService.call(this);
        service.touch();
        try {
          if (service.state !== READY) throw service._buildInvalidStateError();
          return method.apply(this, arguments);
        } catch (error) {
          if (service.state !== READY)  error = service._buildInvalidStateError(error); // TODO: Remove duble InvalidState
          if (addContextToError(args, newArgs, error, {svc: this._name, method: methodName})) this._reportError(error);
          throw error;
        }
      }

    }
  }
  prototypeOrInstance.__serviceStateValidationAdded = true;
}
