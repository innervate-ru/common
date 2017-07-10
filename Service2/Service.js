import throwIfMissing from 'throw-if-missing'

export const DEFAULT_RESTART_INTERVAL = 60000;

export const NOT_INITIALIZED = Symbol('not initialied');
export const WAITING_OTHER_SERVICES_TO_START = Symbol('waiting other services to start');
export const INITIALIZING = Symbol('initializing');
export const INITIALIZED = Symbol('initialized');
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

export default function Service(name, service, options = {}) {

  const serviceInit = service._serviceInit;
  const serviceStart = service._serviceStart;
  const serviceStop = service._serviceStop;
  const serviceDispose = service._serviceDispose;

  let state = NOT_INITIALIZED;
  let isAllDependsOnReady = true;
  let listeners, failureReason, restartTimer, stopped, dispose, currentOperationPromise;

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

  Object.defineProperty(service, '_seriveName', {value: name});
  Object.defineProperty(service, '_state', {get: () => state});
  service._serviceSubscribe = (listener = throwIfMissing('listener')) => {
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
  service._stop = () => {
    stopped = true;
    nextStateStep();
  };
  service._start = () => {
    stopped = false;
    nextStateStep();
  };
  service._dispose = () => {
    dispose = true;
    nextStateStep();
  };

  function setState(newState, {reason, method} = {}) {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (reason) {
      failureReason = reason;
      restartTimer = setTimeout(() => {
        failureReason = null;
        state = STOPPED;
        nextStateStep();
      }, restartInterval);
    } else {
      failureReason = null;
    }

    failureReason = reason ? reason : null;

    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (method)
      (currentOperationPromise = method.call(service))
        .then(nextStateStep, nextStateStep);
    else
      currentOperationPromise = null;

    if (listeners )
      for (let i = listeners .length; i >= 0; i--)
        listeners [i](newState, state, reason);
    state = newState;
    nextStateStep();
  }

  function nextStateStep() {
    switch (state) {
      case NOT_INITIALIZED:
        if (isAllDependsOnReady) setState(INITIALIZING, {method: serviceInit});
        else setState(WAITING_OTHER_SERVICES_TO_START);
        break;
      case WAITING_OTHER_SERVICES_TO_START:
        if (dispose) setState(DISPOSING, {method: serviceDispose});
        else if (isAllDependsOnReady) setState(INITIALIZING, {method: serviceInit});
        return;
      case INITIALIZING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) setState(STOPPED);
        else if (currentOperationPromise.isRejected()) setState(INITIALIZE_FAILED);
        break;
      case STOPPED:
        if (dispose) setState(DISPOSING, {method: serviceDispose});
        else if (!failureReason && isAllDependsOnReady && !stopped) setState(STARTING, {method: serviceStart});
        break;
      case STARTING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) {
          if (!stopped) setState(READY);
          else setState(STOPPING, {method: serviceStop});
        }
        else if (currentOperationPromise.isRejected()) failedState(currentOperationPromise.reason);
        break;
      case READY:
        if (!isAllDependsOnReady || stopped || failureReason || dispose) setState(STOPPING, {method: serviceStop});
        break;
      case STOPPING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled()) {
          if (failureReason) setFailed(failureReason);
          else setState(STOPPED);
        } else {
          if (currentOperationPromise.isRejected()) {
            if (failureReason) setFailed(failureReason);
            else setFailed(currentOperationPromise.reason);
          }
        }
        break;
      case FAILED: // будет переведен в состояние STOPPED после restartInterval (см. setTimeout в setFailed() выше)
        if (dispose) setState(DISPOSING, {method: serviceDispose});
        else if (stopped) setState(STOPPED);
        break;
      case INITIALIZE_FAILED:
        if (dispose) setState(DISPOSING, {method: serviceDispose});
        break;
      case DISPOSING:
        if (!currentOperationPromise || currentOperationPromise.isFulfilled() || currentOperationPromise.isRejected()) setState(DISPOSED);
        return DISPOSING; // если целевое состояние DISPOSED
        break;
    }
  }
  nextStateStep();
  return service;
}


