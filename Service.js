import throwIfMissing from 'throw-if-missing'

import InvalidServiceStateException from './errors/InvalidServiceStateException'

export const NOT_INITIALIZED = Symbol('not init');
export const READY = Symbol('ready');
export const STOPPED = Symbol('stopped');
export const FAILURE = Symbol('failure');

/**
 * Базовый класс для всех классов сервисах. Предоставляет стандартное решение для управления состоянием сервиса.
 */
export default class Service {

  /**
   * Текущий статус сервиса.
   *
   * @type {Symbol}
   * @private
   */
  __state = NOT_INITIALIZED;

  /**
   *
   *
   * @type {null}
   * @private
   */
  __stateReason = null;

  /**
   * Слушатели изменения статуса сервиса.
   *
   * @type {null}
   * @private
   */
  __stateListeners = null;

  /**
   * Изменяет состояние на указанное, с возможным указанием причины.
   *
   * @param state
   * @param reason
   * @private
   */
  __stateSet(state, reason) {

    let prevState = this.__state;
    this.__state = state;
    this.__stateReason = reason ? reason : null;

    if (prevState != state && this.__stateListeners)
      for (let listener of this.__stateListeners)
        listener(state, prevState, reason);
  }

  _checkState() {
    if (this.__state != READY)
      throw new InvalidServiceStateException({state: this.__state});
  }

  /**
   * Метод, который надо вызывать в конце методов _init() классов наследников.  Вызывать как super._init().
   */
  _init() {
    this.__stateSet(READY);
  }

  /**
   * Сервис остановлен.
   *
   * @private
   */
  __stopped() {
    this.__stateSet(STOPPED);
  }

  /**
   * Сервис снова запущен.
   *
   * @private
   */
  __started() {
    this.__stateSet(READY);
  }

  /**
   * Сервис остановлен из-за ошибки.
   *
   * @param reason Причина ошибки.
   * @private
   */

  __failed(reason = throwIfMissing('reason')) {
    this.__stateSet(FAILURE, reason);
  }

  /**
   * Добавляет слушателя изменений состояния.
   *
   * @param listener
   * @returns {function()}
   * @private
   */
  __stateAddListener(listener = throwIfMissing('listener')) {

    if (!this.__stateListeners) this.__stateListeners = [];

    this.__stateListeners.push(listener);

    return () => {
      if (this.__stateListeners) {
        let index = this.__stateListeners.findIndex(listener);
        if (index >= 0)
          if (this.__stateListeners.length == 1)
            this.__stateListeners = null;
          else
            this.__stateListeners.splice(index, 1);
      }
    }
  }
}
