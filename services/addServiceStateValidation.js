import {missingArgument, invalidArgument} from '../utils/arguments'
import prettyPrint from '../utils/prettyPrint'
import {READY} from './Service.states'

/**
 * Все публичные методы данного класса оборачиваются проверкой, что сервис находится в состоянии READY.  Если это
 * основной класс сервиса, то
 *
 *
 */
export default function addServiceStateValidation(serviceClass = missingArgument('serviceClass'), getService = missingArgument('getService')) {
  if (!(typeof serviceClass === 'function')) invalidArgument('serviceClass', serviceClass);
  if (!(typeof getService === 'function')) invalidArgument('getService', getService);
  if ('__addServiceStateValidation' in serviceClass.prototype) return; // уже обработанный класс
  for (const methodName of Object.getOwnPropertyNames(serviceClass.prototype)) {
    if (methodName === 'constructor') continue;
    if (!methodName.startsWith('_')) {
      let propType;
      try {
        propType = typeof serviceClass.prototype[methodName];
      } catch (error) {
        continue; // это может быть get метод, который сработал с ошибкой, так как this не верный
      }
      if (propType !== 'function') continue; // оборачиваем проверкой только методы, которые могли быть определены как методы класса, или через Object.defineProperties
      const privateMethodName = `_${methodName}`;
      if (privateMethodName in serviceClass.prototype)
        throw new Error(`Class ${prettyPrint(serviceClass)}: Already has private method ${privateMethodName}. This name is required to give not-restricted access to original method`);
      const method = serviceClass.prototype[methodName];
      serviceClass.prototype[privateMethodName] = method;
      serviceClass.prototype[methodName] = function () {
        const service = getService.call(this);
        if (service.state !== READY) throw this._service._buildInvalidStateError();
        service.touch();
        try {
          return method.apply(this, arguments);
        } catch (error) {
          if (service._service.state === READY) throw error;
          else throw service._buildInvalidStateError(error);
        }
      }
    }
  }
  serviceClass.prototype.__addServiceStateValidation = true;
}
