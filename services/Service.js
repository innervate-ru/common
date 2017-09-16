import oncePerServices from './oncePerServices'
import defineProps from '../utils/defineProps'
import prettyPrint from '../utils/prettyPrint'
import allErrorInfoToMessage from '../utils/allErrorInfoToMessage'
import InvalidServiceStateError from './InvalidServiceStateError'
import flattenDeep from 'lodash/flattenDeep'
import uniq from 'lodash/uniq'
import cleanStack from 'clean-stack'
import addServiceStateValidation from './addServiceStateValidation'

export const DEFAULT_FAIL_RECOVERY_INTERVAL = 60000;

import {NOT_INITIALIZED, WAITING_OTHER_SERVICES_TO_START, INITIALIZING, INITIALIZE_FAILED, STARTING, READY, STOPPING, STOPPED, FAILED, DISPOSING, DISPOSED} from './Service.states'

export default oncePerServices(function (services) {

  const {bus, testMode} = services; // testMode это hack для тестирования - это не сервис, а просто boolean значение ...но он тут никому не должно мешать

  class Service {

    constructor(name, serviceImpl, SERVICE_TYPE, options) { // SERVICE_TYPE может быть undefined, или это значение свойства SERVICE_TYPE конструктора сервиса

      this._serviceType = SERVICE_TYPE;

      /**
       * Время, когда была выполнена первая операция на сервисе, после запуска.  Нужно, чтобы отслеживать интервал который сервис работает без ошибок.
       */
      this._firstOpTime = null;

      /**
       * Счетчик быстрых перезагрузок - когода перезагрузка происходит сразу после ошибки.  Нужно, чтобы при частых быстрых перезагрузках, сервис останавливался в состоянии FAILED.
       */
      this._quickRestartsCount = 0;

      /**
       * Имя сервиса, состоящие из имени узла (node) и имени сервиса разделенных двоеточием.
       */
      this._name = `${services.manager.get('name')}:${name}`;

      require('./Service.schema').ServiceClassOptions(options, {copyTo: this, argument: 'options', name: this._name});

      /**
       * Состояние в котором находится сервис.
       */
      this._state = NOT_INITIALIZED;

      /**
       * Реализация сервиса.  Управляющий объект сервисом (этот класс), доступен как свойтсво _service в объекте реализации.
       */
      this._serviceImpl = serviceImpl;

      /**
       * Период в миллисекундах, через который сервис пробует перезапуститься после фатальной ошибки, приведшей к переходу в состояние FAIL.
       */
      this._failRecoveryInterval = (options && options.failRecoveryInterval) || DEFAULT_FAIL_RECOVERY_INTERVAL;

      /**
       * Причина остановки сервис.  Объект типа Error.
       */
      this._failureReason = null;

      /**
       * Таймер переводящий из состояния FAILED в STOPPED после интервала время ожидания после ошибки.
       */
      this._restartTimer = null;

      /**
       * Promise возвращенный текущей асинхронной операцией, по завершению которого должна произойти смена состояния.
       */
      this._currentOpPromise = null;

      /**
       * Объект-реализация сервиса, опционально может иметь методы реализующие инициализацию, запуск, остановку
       * и диструкцию сервиса.
       */
      ['_serviceInit', '_serviceStart', '_serviceStop', '_serviceDispose'].forEach(m => {
        if (m in serviceImpl) {
          const method = serviceImpl[m];
          if (!(typeof method === 'function'))
            throw new Error(`Service ${this._name}: Expected '${m}' to be a method on object: ${prettyPrint(serviceImpl)}`);
          this[m] = method;
        }
      });

      /**
       * true, если сервис или не зависит от других сервисов, или все сервисы от которых зависит этот сервис находятся в состоянии READY
       */
      this._isAllDependsAreReady = true;

      /**
       * true, если был вызван метод stop()
       */
      this._stop = false; //

      /**
       * true, если был вызван метод dispose()
       */
      this._dispose = false;

      /**
       * Карта зависимостей: ключ - имя сервиса; значение - true, если сервис в состоянии READY
       */
      this._dependsOn = null;

      if (options && options.dependsOn) {
        const dependsOn = uniq(flattenDeep(options.dependsOn)); // зависимости могут состоять из массивов зависимостей, и элементы могут повторяться
        if (dependsOn.length > 0) {
          const dependsOnTotal = dependsOn.length;
          const dependsOnMap = this._dependsOn = {};
          let dependsOnCount = 0;
          dependsOn.forEach(v => {
            if (dependsOnMap[v._service.name] = (v._service.state === READY)) dependsOnCount++;
          });
          this._isAllDependsAreReady = (dependsOnCount === dependsOnTotal);
          bus.on('service.state', ev => {
            if (hasOwnProperty.call(dependsOnMap, ev.source)) {
              const isReady = dependsOnMap[ev.source];
              if (isReady) {
                if (ev.state !== READY) {
                  dependsOnMap[ev.source] = false;
                  dependsOnCount--;
                  if (this._isAllDependsAreReady) {
                    this._isAllDependsAreReady = false;
                    this._nextStateStep();
                  }
                }
              } else {
                if (ev.state === READY) {
                  dependsOnMap[ev.source] = true;
                  dependsOnCount++;
                  if (this._isAllDependsAreReady = (dependsOnCount === dependsOnTotal))
                    this._nextStateStep();
                }
              }
            }
          });
        }
      }

      // TODO: Добавить состояние и логику для быстрой перезагрузке в состоянии READY
      // TODO: Uptime
    }

    _nextStateStep() {
      switch (this._state) {
        case NOT_INITIALIZED:
          if (this._isAllDependsAreReady) this._setState(INITIALIZING, {method: this._serviceInit, nextState: STOPPED});
          else this._setState(WAITING_OTHER_SERVICES_TO_START);
          break;
        case WAITING_OTHER_SERVICES_TO_START:
          if (this._dispose) this._setState(DISPOSING, {method: this._serviceDispose, nextState: DISPOSED});
          else if (this._isAllDependsAreReady) this._setState(INITIALIZING, {
            method: this._serviceInit,
            nextState: STOPPED
          });
          return;
        case INITIALIZING:
          if (this._currentOpPromise.isFulfilled()) this._setState(STOPPED);
          else if (this._currentOpPromise.isRejected()) this._setState(INITIALIZE_FAILED, {failureReason: this._currentOpPromise.reason()});
          break;
        case STOPPED:
          if (this._dispose) this._setState(DISPOSING, {method: this._serviceDispose, nextState: DISPOSED});
          else if (this._isAllDependsAreReady && !this._stop) this._setState(STARTING, {
            method: this._serviceStart,
            nextState: READY
          });
          break;
        case STARTING:
          if (this._currentOpPromise.isFulfilled()) {
            if (this._stop || !this._isAllDependsAreReady) this._setState(STOPPING, {
              method: this._serviceStop,
              nextState: STOPPED
            });
            else this._setState(READY);
          }
          else if (this._currentOpPromise.isRejected()) this._setState(STOPPING, {
            method: this._serviceStop,
            failureReason: this._currentOpPromise.reason(),
            nextState: FAILED,
          });
          break;
        case READY:
          this._firstOpTime = null;
          if (!this._isAllDependsAreReady || this._stop || this._failureReason || this._dispose) this._setState(STOPPING, {
            method: this._serviceStop,
            failureReason: this._failureReason,
            nextState: this._failureReason ? FAILED : STOPPED,
          });
          break;
        case STOPPING:
          if (this._currentOpPromise.isFulfilled() || this._currentOpPromise.isRejected()) {
            if (this._failureReason) this._setState(FAILED, {failureReason: this._failureReason}); // сохраняем ошибку из-за которой мы вышли или из состояния READY или из STARTING
            else this._setState(STOPPED);
          }
          break;
        case FAILED: // будет переведен в состояние STOPPED после restartInterval (см. setTimeout в setFailed() выше)
          if (this._dispose) this._setState(DISPOSING, {method: this._serviceDispose, nextState: DISPOSED});
          else if (this._stop) this._setState(STOPPED);
          break;
        case INITIALIZE_FAILED:
          if (this._dispose) this._setState(DISPOSING, {method: this._serviceDispose, nextState: DISPOSED});
          break;
        case DISPOSING:
          if (this._currentOpPromise.isFulfilled() || this._currentOpPromise.isRejected()) this._setState(DISPOSED);
          break;
        // case DISPOSED:
        //   // nothing
        //   break;
      }
    }

    /**
     * Переход в новое состояние, с уведомление об этом всех кто подписан через _serviceSubscribe.
     *
     * @param newState Состояние в которое надо перейти
     * @param [failureReason ] Причина ошибки.  Только для перехода в состояние FAILED
     * @param [method] Метод класса реализации сервиса, который надо вызвать в этом состоянии
     * @param [nextState] Сосоояние в которое нужно перейти, если method не определен в реализации сериса
     */
    _setState(newState, {failureReason, method, nextState} = {}) {

      if (this._restartTimer) {
        clearTimeout(this._restartTimer);
        this._restartTimer = null;
      }

      this._failureReason = failureReason || null;

      if (method) {

        const promise = this._currentOpPromise = method.call(this._serviceImpl).catch(this._reportMethodError);
        if (!('then' in promise)) throw new Error(`Method must return a promise: ${prettyPrint(method)}`);

        if (testMode)
          this._testWaitPromise = this._currentOpPromise; // в режиме тестирования this._nextStateStep не вызывается по завершению асинхронного метода - нужно явно вызвать nextStateStep в коде
        else {
          this._currentOpPromise.then(this._callNextStateStep).catch(this._callNextStateStep);
        }

      } else {
        this._currentOpPromise = null;
        this._testWaitPromise = null;
        newState = nextState || newState;
      }

      if (newState === FAILED)
        this._restartTimer = setTimeout(() => {
          this._setState(STOPPED);
        }, this._failRecoveryInterval);

      const prevState = this._state;
      this._state = newState;

      // TODO: Think of making this a debug output
      // console.info(`${prevState.toString()} -> ${this._state.toString()}${nextState ? `(${nextState.toString()})` : ''}; method: ${!!method}; reason: ${!!reason}`);

      const ev = {
        time: new Date().getTime(),
        type: 'service.state',
        source: this._name,
        state: newState,
        prevState,
      };
      if (this._failureReason) ev.reason = this._failureReason.message;
      if (this._serviceType) ev.serviceType = this._serviceType;
      bus.event(ev);

      // этот вызов должен идти после отправки события о смене состояния в bus
      if (newState === DISPOSED) this._dispose(); // это resolve для Pormise который верул метод dispose()

      if (!testMode) this._nextStateStep();
    }

    /**
     * Логирует ошибку полученную из Promise в bus.
     *
     * Прим.: Такая форма записи в ES6 делает метод который уже привязан к инстансу объекта
     */
    _reportMethodError = (error) => {
      this.reportError(error);
      return Promise.rejected(error);
    };

    /**
     * Вызывает метода this._nextStateStep() после того как Promise зарезолвился или кинул ошибку.
     *
     * Прим.: Такая форма записи в ES6 делает метод который уже привязан к инстансу объекта
     */
    _callNextStateStep = () => {
      this._nextStateStep();
      return true;
    };

    /**
     * Запуск сервиса, если он раньше был остановлен методом stop().
     */
    start() {
      this._stop = false;
      this._nextStateStep();
    }

    /**
     * Принудительная остановка сервис.  При этом сбрасывается таймер перезапуска сервиса, если он раньше был остановлен из-за ошибки.
     */
    stop() {
      this._stop = true;
      this._nextStateStep();
    }

    touch() {
      if (this._firstOpTime === null) this._firstOpTime = new Date().getTime();
    }

    /**
     * Разборка сервиса.  Возвращает Promise, который будет resolved, когда состояние будет DISPOSED.
     */
    dispose() {
      const res = new Promise((resolve, reject) => {
        this._dispose = resolve;
      });
      this._nextStateStep();
      return res;
    }

    /**
     * Критическая ошибка при работе сервиса, требующая его временной остановки.
     * @param error Объект типа Error
     */
    criticalFailure(error) {
      if (this._state !== READY) throw new Error(`Critical error thrown in wrong state '${this._state}': '${prettyPrint(error)}'`);
      if (!(error instanceof Error)) error = new Error(`Invalid argument 'error': ${prettyPrint(err)}`);
      this._failureReason = error;
      this.reportError(error);
      this._nextStateStep();
    }

    /**
     * Отправляет ошибку в шину, с указанием сервиса как источника данных об ошибке.
     * @param error Объект типа Error
     */
    reportError(error) {
      if (!(error instanceof Error)) error = new Error(`Invalid argument 'error': ${prettyPrint(err)}`);
      const fixedError = allErrorInfoToMessage(error);
      const errEvent = {
        time: new Date().getTime(),
        type: 'service.error',
        source: this._name,
        message: fixedError.message,
        stack: cleanStack(fixedError.stack, {pretty: true}),
      };
      if (this._serviceType) errEvent.serviceType = this._serviceType;
      bus.error(errEvent);
    }

    _buildInvalidStateError(error) {
      return new InvalidServiceStateError({service: this._serviceImpl, state: this.state, error: error})
    };
  }

  defineProps(Service, {
    name: {
      get() {
        return this._name;
      },
    },
    dependsOn: {
      get() {
        return this._dependsOn;
      },
    },
    serviceImpl: {
      get() {
        return this._serviceImpl;
      },
    },
    state: {
      get() {
        return this._state;
      },
    },
    failureReason: {
      get() {
        return this._failureReason;
      },
    },
  });

  return function (serviceClass) {

    // Делаем класс наследник, который добавляем в объект свойство _service
    class ServiceImpl extends serviceClass {
      constructor(name, options) {
        super(options);
        this._service = new Service(name, this, serviceClass.SERVICE_TYPE, options);
        if (!testMode) this._service._nextStateStep();
      }
    }

    addServiceStateValidation(serviceClass, function() { return this._service; });

    return ServiceImpl;
  }
});
