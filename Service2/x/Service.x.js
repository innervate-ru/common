import throwIfMissing from 'throw-if-missing'

import InvalidServiceStateException from '../../errors/InvalidServiceStateException'

export const NOT_INITIALIZED = Symbol('not init');
export const WAITING_OTHER_SERVICES_TO_START = Symbol('waiting other services to start');
export const INITIALIZED = Symbol('initialized');
export const INITIALIZE_FAILED = Symbol('initialize failed');
export const STARTING = Symbol('starting');
export const READY = Symbol('ready');
export const STOPPING = Symbol('stopping');
export const STOPPED = Symbol('stopped');
export const FAILED = Symbol('failed');
export const DISPOSING = Symbol('disposing');
export const DISPOSED = Symbol('disposed');

export function wrapByReadyStateCheck(serviceClass) => {
  const proto = serviceClass.prototype;
  for (methodName in proto) {
    if (!methodName.startsWith('_')) {
      const method = proto[methodName];
      proto[methodName] = function () {
        const serviceManager = this.__serviceManager;
        if (!(this.__serviceManager.state == READY)) throw InvalidServiceStateError({
          serviceName: serviceManager.serviceName,
          state: serviceManager.state
        });
        method.call(this, arguments);
      }
    }
  }

// TODO: Сделать класс Service, который ставит ServiceStateManager на место
// TODO: Вставить в конструктор проверку текущих состояний dependsOn
// TODO: Запустить машину состояний - но получается что serviceInit может начать сразу в конструкторе ...но асинхронно - it's ok
// нужен ли статй not_init или сразу начинать с await или initializing
// сделать менеджер для сервисов
// методы _service... должны возвращать promise

  export class ServiceStateManager {

    service = null;

    state = NOT_INITIALIZED;

    stopped = true;

    dispose = false;

    failureReason = null;

    isAllDependsOnReady = false;

    currentOperationPromise = null;

    restartInterval = null;

    restartTimer = null;

    stateListeners = null;

    setState(state) {
      this.setState(state);
      this.currentOperationPromise = null;
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      this.nextStateStep();
    }

    setActiveState(state, method) {
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      const method = service[method];
      if (method) {
        this.setState(state);
        (this.currentOperationPromise = service[method].call(service))
          .then(this.onActiveStateCompleted, this.onActiveStateCompleted);
      } else {
        this.state = state; // меняем состояния без уведомления подписчиков
        this.currentOperationPromise = null;
        this.nextStateStep();
      }
    }

    setFailed(reason) {
      this.failureReason = reason;
      if (this.state == READY) this.nextStateStep(); // go thru _serviceStop()
      else { // immidiate failure
        this.state = FAILED;
        this.currentOperationPromise = null;
        this.restartTimer = setTimeout(() => {
          this.failureReason = null;
          this.state = STOPPED;
          his.nextStateStep();
        }, this.restartInterval);
      }
    }

    subscribe(listener = throwIfMissing('listener')) {

      if (!this.stateListeners) this.stateListeners = [];

      this.stateListeners.push(listener);

      return () => {
        if (this.stateListeners) {
          let index = this.stateListeners.findIndex(listener);
          if (index >= 0)
            if (this.stateListeners.length == 1)
              this.stateListeners = null;
            else
              this.stateListeners.splice(index, 1);
        }
      }
    }

    stateSet(state, reason) {
      const prevState = this.state;
      this.state = state;
      this.failureReason = reason ? reason : null;
      if (this.stateListeners)
        for (let i = this.stateListeners.length; i >= 0; i--)
          this.stateListeners[i](state, prevState, reason);
    }


    constructor(service, name, options = {}) {
      if (!(typeof('name') == 'string' && serviceName.length > 0)) new Error(`Invalid argument 'name': ${name}`);

      this.onActiveStateCompleted = this.nextStateStep.bind(this);

      const {dependsOn, restartInterval, ...restOptions} = options;

      if (dependsOn) {
        if (!(Array.isArray(dependsOn))) new Error(`Invalid option 'dependsOn': ${dependsOn}`);
        let dependsOnInReadyStateCount = 0;
        const dependsOnСount = dependsOn.length;
        if (dependsOnCount == 0)
          this.isAllDependsOnReady = true;
        else {
          const dependsOnSvcStateChange = (state, prevState, reason) => {
            if (state == READY) dependsOnInReadyStateCount++;
            else if (prevState == READY) dependsOnInReadyStateCount--;
            const isAllDependsOnReady = (dependsOnInReadyStateCount == dependsOnСount);
            if (this.isAllDependsOnReady != isAllDependsOnReady) {
              this.isAllDependsOnReady = isAllDependsOnReady;
              this.nextStateStep();
            }
          };
          dependsOn.forEach((svc, i) => {
            if (!(svc instanceof Service)) throw new new Error(`Invalid value in option 'dependsOn' position ${i}: ${svc}`);
            svc.__serviceManager.subscribe(dependsOnSvcStateChange)
          });
        }
      }

      if (!(typeof restartInterval == 'number' && restartInterval >= 0)) new Error(`Invalid option 'restartInterval': ${restartInterval}`);

      service._stop = () => {
        this.stopped = true;
        nextStateStep();
      };

      service._start = () => {
        this.stopped = false;
        nextStateStep();
      };

      service._dispose = () => {
        this.dispose = true;
        nextStateStep();
      };

      service._fireFailure = this.setFailed.bind(this);

      service.__serviceManager = this;
    }

    nextStateStep() {
      switch (this.__serviceState) {
        case NOT_INITIALIZED:
          if (this.isAllDependsOnReady) this.setActiveState(INITIALIZING, '_serviceInit');
          else this.setState(WAITING_OTHER_SERVICES_TO_START);
          break;
        case WAITING_OTHER_SERVICES_TO_START:
          if (this.dispose) this.setActiveState(DISPOSING, '_serviceDispose');
          else if (this.isAllDependsOnReady) this.setActiveState(INITIALIZING, '_serviceInit');
          return;
        case INITIALIZING:
          if (!this.currentOperationPromise || this.currentOperationPromise.isFulfilled()) this.setState(STOPPED);
          else if (this.currentOperationPromise.isRejected()) this.setState(INITIALIZE_FAILED);
          break;
        case STARTING:
          if (this.currentOperationPromise || this.currentOperationPromise.isFulfilled()) {
            if (!this.stopped) this.setState(READY);
            else this.setActiveState(STOPPING, '_serviceStop');
          }
          else if (this.currentOperationPromise.isRejected()) this.failedState(this.currentOperationPromise.reason);
          break;
        case READY:
          if (!this.isAllDependsOnReady || this.__serviceStopped || this.failureReason) this.setActiveState(STOPPING, '_serviceStop');
          break;
        case STOPPING:
          if (!this.currentOperationPromise || this.currentOperationPromise.isFulfilled()) {
            if (this.failureReason) this.setFailed(this.failureReason);
            else this.setState(STOPPED);
          } else {
            if (this.currentOperationPromise.isRejected()) {
              if (this.failureReason) this.setFailed(this.failureReason);
              else this.setFailed(this.currentOperationPromise.reason);
            }
          }
          break;
        case STOPPED:
          if (this.dispose) this.setActiveState(DISPOSING, '_serviceDispose');
          else if (!this.failureReason && this.isAllDependsOnReady && !this.stopped) this.setActiveState(STARTING, '_serviceStart');
          break;
        case FAILED: // будет переведен в состояние STOPPED после restartInterval (см. setTimeout в setFailed() выше)
          if (this.stopped) this.setState(STOPPED);
          if (this.dispose) this.setActiveState(DISPOSING, '_actionDispose');
          break;
        case INITIALIZE_FAILED:
          if (this.dispose) this.setActiveState(DISPOSING, '_actionDispose');
          break;
        case DISPOSING:
          if (!this.currentOperationPromise || this.currentOperationPromise.isFulfilled() || this.currentOperationPromise.isRejected()) this.setState(DISPOSED);
          return DISPOSING; // если целевое состояние DISPOSED
          break;
      }
    }
  }


  /**
   * Базовый класс для всех классов сервисах. Предоставляет стандартное решение для управления состоянием сервиса.
   */
  export default class Service {

    // Методы, которые можно переопределять в классе наследнике.  Вызывать super нет необходимости.

    async _serviceInit() {
    }

    async _serviceStart() {
    }

    async _serviceStop() {
    }

    async _serviceDispose() {
    }

    async _serviceKeepAlive() {
    }

    /**
     *
     * @param {String} serviceName Уникальное название сервиса
     * @param {Object} options
     * @param {Service[]} options.dependsOn Массив объектов instanceOf Service, от которых зависит сервис;
     * @param {number} [options.restartInterval = 40000] Через какой промежуток времени пытаться перезапустить сервис.  По умолчанию: 40000 (40 сек)
     * @param {number} [options.keepAliveInterval = null] Период через который вызывается метод _serviceKeepAlive().  Если null, то метод serviceKeepAlive не вызывается
     */
    constructor(serviceName = throwIfMissing('serviceName'), options = {}) {
      if (!(typeof('serviceName') == 'string' && serviceName.length > 0)) new Error(`Invalid argument 'serviceName': ${serviceName}`);
      const {dependsOn, restartInterval, keepAliveInterval, ...restOptions} = options;

      setTimeout(this._serviceInit, 0);


    }


    // /**
    //  * Название сервиса
    //  */
    // __serviceName = null;
    //
    //
    // /**
    //  * Сервисы от которых зависит этот сервис.
    //  */
    // __dependsOn = [];
    //
    //
    // /**
    //  * true, если сервис остановлен через метод stop
    //  */
    // __stopped = false;
    //
    //
    //
    //
    //
    //
    //
    //
    //
    // constructor(name, args = {}) {
    //   const {dependsOn} = args;
    //   if (!(typeof args == 'object')) throw new Error(`Invalid argemtns 'args': ${args}`);
    //   if (!(typeof name == 'string')) throw new Error(`Invalid argemtns 'name': ${name}`);
    //   if (!(!dependsOn || Array.isArray(dependsOn))) throw new Error(`Invalid argemtns 'dependsOn': ${dependsOn}`);
    //   // TODO: Регистрировать сервис.  Проверять что имя уникально
    //   this.__serviceName = name;
    //   if (dependsOn) {
    //     this.__dependsOn = dependsOn;
    //     dependsOn.forEach((svc) => {
    //       if (!(svc instanceof Service)) throw new Error(`Not a service: ${svc}`)
    //       svc.__stateSubscribe()
    //     });
    //   }
    // }
    //
    //
    // /**
    //  * Текущий статус сервиса.
    //  *
    //  * @type {Symbol}
    //  * @private
    //  */
    // __state = NOT_INITIALIZED;
    //
    // /**
    //  *
    //  *
    //  * @type {null}
    //  * @private
    //  */
    // __stateReason = null;
    //
    // /**
    //  * Слушатели изменения статуса ервиса.
    //  *
    //  * @type {null}
    //  * @private
    //  */
    // __stateListeners = null;
    //
    // /**
    //  * Изменяет состояние на указанное, с возможным указанием причины.
    //  *
    //  * @param state
    //  * @param reason
    //  * @private
    //  */
    // __stateSet(state, reason) {
    //
    //   let prevState = this.__state;
    //   this.__state = state;
    //   this.__stateReason = reason ? reason : null;
    //
    //   if (prevState != state && this.__stateListeners)
    //     for (let i = this.__stateListeners.length; i >= 0; i--)
    //       this.__stateListeners[i](state, prevState, reason);
    // }
    //
    // _checkState() {
    //   if (this.__state != READY)
    //     throw new InvalidServiceStateException({state: this.__state});
    // }
    //
    // /**
    //  * Метод, который надо вызывать в конце методов _init() классов наследников.  Вызывать как super._init().
    //  */
    // _init() {
    //   this.__stateSet(READY);
    // }
    //
    // /**
    //  * Освобождает ресурсы используемые сервисы.  Например, соединение в БД.
    //  */
    // _dispose() {
    //   this.__stateSet(DISPOSED);
    // }
    //
    // /**
    //  * Сервис остановлен.
    //  *
    //  * @private
    //  */
    // __stopped() {
    //   this.__stateSet(STOPPED);
    // }
    //
    // /**
    //  * Сервис снова запущен.
    //  *
    //  * @private
    //  */
    // __started() {
    //   this.__stateSet(READY);
    // }
    //
    // /**
    //  * Сервис остановлен из-за ошибки.
    //  *
    //  * @param reason Причина ошибки.
    //  * @private
    //  */
    //
    // __failed(reason = throwIfMissing('reason')) {
    //   this.__stateSet(FAILURE, reason);
    // }
    //
    // /**
    //  * Добавляет слушателя изменений состояния.
    //  *
    //  * @param listener
    //  * @returns {function()}
    //  * @private
    //  */
    // __stateSubscribe(listener = throwIfMissing('listener')) {
    //
    //   if (!this.__stateListeners) this.__stateListeners = [];
    //
    //   this.__stateListeners.push(listener);
    //
    //   return () => {
    //     if (this.__stateListeners) {
    //       let index = this.__stateListeners.findIndex(listener);
    //       if (index >= 0)
    //         if (this.__stateListeners.length == 1)
    //           this.__stateListeners = null;
    //         else
    //           this.__stateListeners.splice(index, 1);
    //     }
    //   }
    // }
  }
}
