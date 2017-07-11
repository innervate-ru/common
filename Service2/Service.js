import throwIfMissing from 'throw-if-missing'

export const DEFAULT_RESTART_INTERVAL = 60000;

export const NOT_INITIALIZED = Symbol('not initialied');
export const WAITING_OTHER_SERVICES_TO_START = Symbol('waiting other services to start');
export const INITIALIZING = Symbol('initializing');
export const INITIALIZE_FAILED = Symbol('initialize failed');
export const STARTING = Symbol('starting');
export const READY = Symbol('ready');
export const STOPPING = Symbol('stopping');
export const STOPPED = Symbol('stopped');
export const FAILED = Symbol('failed');
export const DISPOSING = Symbol('disposing');
export const DISPOSED = Symbol('disposed');

// кдасс serviceStateManager
// враппер, который добавляет - serviceState; оборачивает методы без _ в проверку что состояние READY

const RESOLVED_PROMISE = Promise.resolve();

export default function Service(name, service, options = {}) {

  const wrappedService = Object.create(null);
  wrappedService.__proto__ = service;

  const serviceInit = service._serviceInit;
  const serviceStart = service._serviceStart;
  const serviceStop = service._serviceStop;
  const serviceDispose = service._serviceDispose;

  let state = NOT_INITIALIZED;
  let isAllDependsOnReady = true, listeners = null, failureReason = null, restartTimer = null;
  let stopped = false, dispose = null, currentOperationPromise = null, testWaitPromise = null;

  if (!(typeof('name') == 'string' && name.length > 0)) new Error(`Invalid argument 'name': ${name}`);

  const {dependsOn, restartInterval = DEFAULT_RESTART_INTERVAL, ...restOptions} = options;

  if (Object.keys(restOptions).length > 0) throw new Error(`Unexpected options: ${Object.keys(restOptions).join()}`)

  if (dependsOn) {
    if (!(Array.isArray(dependsOn))) new Error(`Invalid option 'dependsOn': ${dependsOn}`);
    let dependsOnInReadyStateCount = 0;
    const dependsOnСount = dependsOn.length;
    if (dependsOnCount > 0) {
      const dependsOnSvcStateChange = (state, prevState, reason) => {
        if (state == READY) dependsOnInReadyStateCount++;
        else if (prevState == READY) dependsOnInReadyStateCount--;
        const _isAllDependsOnReady = (dependsOnInReadyStateCount == dependsOnСount);
        if (_isAllDependsOnReady != isAllDependsOnReady) {
          isAllDependsOnReady = _isAllDependsOnReady;
          nextStateStep();
        }
      };
      dependsOn.forEach((svc, i) => {
        if (!(svc.hasOwnProperty('_state'))) throw new new Error(`Invalid value in option 'dependsOn' position ${i}: ${svc}`);
        isAllDependsOnReady = isAllDependsOnReady && svc._state == READY;
        svc._serviceSubscribe(dependsOnSvcStateChange);
      });
    }
  }

  if (!(typeof restartInterval == 'number' && restartInterval >= 0)) new Error(`Invalid option 'restartInterval': ${restartInterval}`);

  Object.defineProperty(wrappedService, '_seriveName', {value: name});
  Object.defineProperty(wrappedService, '_state', {get: () => state});
  Object.defineProperty(wrappedService, '_serviceError', {get: () => failureReason});
  wrappedService._serviceSubscribe = (listener = throwIfMissing('listener')) => {
    if (!(typeof listener == 'function')) throw new Error(`Invalid argument 'listener: ${listener}`);
    if (!listeners) listeners = [];
    listeners.push(listener);
    return () => {
      if (listeners) {
        let index = listeners.findIndex(listener);
        if (index >= 0)
          if (listeners.length == 1)
            listeners = null;
          else
            listeners.splice(index, 1);
      }
    }
  };

  /**
   * Возвращает promise, который будет resolved, когда закончится асинхронная операция.
   */
  wrappedService.__testWait = () => {
    console.info('testWaitPromise', !!testWaitPromise);
    return testWaitPromise || RESOLVED_PROMISE;
  };
  wrappedService._stop = () => {
    stopped = true;
    nextStateStep();
  };
  wrappedService._start = () => {
    stopped = false;
    nextStateStep();
  };
  wrappedService._dispose = () => {
    const res = new Promise(function (resolve, reject) {
      dispose = resolve;
    });
    nextStateStep();
    return res;
  };

  /**
   * Переход в новое состояние, с уведомление об этом всех кто подписан через _serviceSubscribe.
   *
   * @param newState Состояние в которое надо перейти
   * @param [reason] Причина ошибки.  Только для перехода в состояние FAILED
   * @param [method] Метод класса реализации сервиса, который надо вызвать в этом состоянии
   * @param [nextState] Сосоояние в которое нужно перейти, если method не определен в реализации сериса
   */
  function setState(newState, {reason, method, nextState} = {}) {

    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    failureReason = reason || null;

    if (method) {
      currentOperationPromise = method.call(service);
      // testWaitPromise = currentOperationPromise.then(nextStateStep).catch(nextStateStep);
      testWaitPromise = currentOperationPromise.then(() => { console.info('?????'); nextStateStep(); return true; }).catch(() => {
        console.info('!!!!');
        nextStateStep();
        return true;
      });
    } else {
      currentOperationPromise = null;
      testWaitPromise = null;
      newState = nextState || newState;
    }

    const prevState = state;
    state = newState;

    // TODO: Think of making this a debug output
    // console.info(`${prevState.toString()} -> ${state.toString()}${nextState ? `(${nextState.toString()})` : ''}; method: ${!!method}`);

    if (listeners)
      for (let i = listeners.length - 1; i >= 0; i--)
        listeners[i](state, prevState, reason);
    nextStateStep();
  }

  function nextStateStep() {
    switch (state) {
      case NOT_INITIALIZED:
        if (isAllDependsOnReady) setState(INITIALIZING, {method: serviceInit, nextState: STOPPED});
        else setState(WAITING_OTHER_SERVICES_TO_START);
        break;
      case WAITING_OTHER_SERVICES_TO_START:
        if (dispose) setState(DISPOSING, {method: serviceDispose, nextState: DISPOSED});
        else if (isAllDependsOnReady) setState(INITIALIZING, {method: serviceInit, nextState: STOPPED});
        return;
      case INITIALIZING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) setState(STOPPED);
        else if (currentOperationPromise.isRejected()) setState(INITIALIZE_FAILED, {reason: currentOperationPromise.reason()});
        break;
      case STOPPED:
        if (dispose) setState(DISPOSING, {method: serviceDispose, nextState: DISPOSED});
        else if (!failureReason && isAllDependsOnReady && !stopped) setState(STARTING, {
          method: serviceStart,
          nextState: READY
        });
        break;
      case STARTING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) {
          if (!stopped) setState(READY);
          else setState(STOPPING, {method: serviceStop, nextState: STOPPED});
        }
        else if (currentOperationPromise.isRejected()) setState(FAILED, {reason: currentOperationPromise.reason()});
        break;
      case READY:
        if (!isAllDependsOnReady || stopped || failureReason || dispose) setState(STOPPING, {
          method: serviceStop,
          nextState: STOPPED
        });
        break;
      case STOPPING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) {
          if (failureReason) setState(FAILED, {reason: failureReason}); // это после ошибки, так что ошибка остается та которая привела к переходу в FAILED
          else setState(STOPPED);
        } else {
          if (currentOperationPromise.isRejected()) {
            if (failureReason) setState(FAILED, {reason: failureReason}); // это после ошибки, так что ошибка остается та которая привела к переходу в FAILED
            else setState(STOPPED, {reason: currentOperationPromise.reason()});
          }
        }
        break;
      case FAILED: // будет переведен в состояние STOPPED после restartInterval (см. setTimeout в setFailed() выше)
        if (dispose) setState(DISPOSING, {method: serviceDispose, nextState: DISPOSED});
        else if (stopped) setState(STOPPED);

        restartTimer = setTimeout(() => {
          setState(STOPPED);
        }, restartInterval);

        break;
      case INITIALIZE_FAILED:
        if (dispose) setState(DISPOSING, {method: serviceDispose, nextState: DISPOSED});
        break;
      case DISPOSING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) setState(DISPOSED);
        else if (currentOperationPromise.isRejected()) setState(DISPOSED, {reason: currentOperationPromise.reason()});
        break;
      case DISPOSED:
        dispose(); // это resolve для Pormise который верул метод _dispose()
        break;
    }
    return true; // необходимо вернуть что нить не undefined, для использования этого метода в Promise.finally
  }

  nextStateStep(); // запускаем первый переход
  return wrappedService;
}


