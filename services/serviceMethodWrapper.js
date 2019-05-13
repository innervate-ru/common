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
export default function serviceMethodWrapper({
                                               prototypeOrInstance = missingArgument('prototypeOrInstance'),
                                               bus = missingArgument('bus'),
                                               getService = missingArgument('getService'),
                                               contextRequired,
                                             }) {
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

        if (contextRequired) {
          if (!(args && typeof args.context === 'string' && args.context.length > 0)) {
            missingArgument('context');
          }
        }

        const newArgs = addContextToArgs(args);
        const service = getService.call(this);
        let attempts = 1;

        while (true) {

          try {
            service._quickRestart && await service._quickRestart;
          } catch (error) {
            // ошибку не обрабатываем, так как при reject выполнится условие ниже service.state !== READY
          }

          if (service.state !== READY) { // проверяем состояние перед операции
            const error = service._buildInvalidStateError();
            if (addContextToError(args, newArgs, error, {
              service: service._name,
              method: methodName
            })) service._reportError(error);
            throw error;
          }
          const startTime = Date.now();
          try {
            const r = await Promise.resolve(method.call(this, newArgs));

            // Если прилетел буффер (файл), убираем его контент
            if (args && args.params) {
              Object.keys(args.params).map(paramKey => {
                if (Buffer.isBuffer(args.params[paramKey])) {
                  args.params[paramKey] = `Buffer (length: ${Buffer.byteLength(args.params[paramKey])})`;
                }
              });
            }

            const duration = Date.now() - startTime;

            const durationSec = duration / 1000;
            service._callAvgCounter(durationSec);
            service._callMaxCounter(durationSec);

            const evMethod = {
              type: 'service.method',
              service: service._name,
              method: methodName,
              context: newArgs.context,
              args: args,
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

            if (service.state !== READY) error = service._buildInvalidStateError(error); // Проверяем состояние сервиса после операции, если ошибка.  Когда сервис не в рабочем состоянии, то не стоит анализировать ошибку
            if (addContextToError(args, newArgs, error, {
              service: service._name,
              method: methodName
            })) {
              const isCriticalError = service._serviceIsCriticalError(error);
              if (!(typeof isCriticalError === 'boolean')) {
                service.criticalFailure(new Error(`service._serviceIsCriticalError returned not a boolean value: ${isCriticalError}`));
              } else if (isCriticalError) {
                service.criticalFailure(error);
              } else {
                service._reportError(error);
              }
            }

            if (args && args.params) {
              Object.keys(args.params).forEach(paramKey => {
                // TODO: zork: Начать подрезать размер строки
                if (Buffer.isBuffer(args.params[paramKey])) {
                  args.params[paramKey] = `Buffer (length: ${Buffer.byteLength(args.params[paramKey])})`;
                }
              });
            }

            const duration = Date.now() - startTime;

            const durationSec = duration / 1000;
            service._callAvgCounter(durationSec);
            service._callMaxCounter(durationSec);

            const evMethod = {
              type: 'service.method',
              service: service._name,
              method: methodName,
              context: newArgs.context,
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
  prototypeOrInstance.__serviceStateValidationAdded = true;
}
