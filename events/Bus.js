import os from 'os'
import EventEmitter from 'events'
import {missingArgument, invalidArgument} from '../utils/arguments'
import configAPI from 'config'
import prettyPrint from '../utils/prettyPrint'
import defineProps from '../utils/defineProps'
import {validateOptionsFactory} from '../validation/validateObject'
import CircularJSON from 'circular-json'
import errorDataToEvent from '../errors/errorDataToEvent'

import {
  CRITICAL_ERROR,
  ERROR,
  WARN,
  INFO,
  ACTION,
  COMMAND,
  EVENT,
  METHOD,
  DEBUG,
} from './Bus.levels'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const realConsole = console;

const noColor = (s) => s;
let logError = noColor, logWarn = noColor, logInfo = noColor, logEvent = noColor;

let graylog = null, graylogCount = 0, graylogStopResolve;
let graylogBackup = null;
let graylogListeners;

function graylogSendCB(err) {
  if (--graylogCount === 0) graylogStopResolve && graylogStopResolve();
}

/* async */
function graylogStop() {
  return new Promise(function (resolve, reject) {
    if (!graylog && !graylogBackup) resolve();
    else {
      graylog = null; // прекращаем отправку сообщений
      graylogBackup = null;
      if (graylogCount === 0) {
        resolve();
      } else {
        graylogStopResolve = resolve;
      }
    }
  });
}

function graylogSend(ev, self) {
  if (graylog) {
    if (!hasOwnProperty.call(ev, 'message')) {
      ev = Object.assign(Object.create(null), ev);
      const {host, timestamp, service, type, ...rest} = ev;
      ev.message = `${service}: ${type}${Object.keys(rest).length > 0 ? ` ${prettyPrint(rest)}` : ''}`;
    }
    ++graylogCount;

    let evStr;
    try {
      evStr = JSON.stringify(ev);
    } catch (err) {
      // we cannot log an event with circular info in it.  And this most likely is a problem in the logic - so we return
      // this error, but make anther record to graylog with json saved in a cicular-safe way.
      const {host, timestamp, service, node, ...rest} = ev;
      const errEv = {
        level: 1,
        host,
        timestamp,
        node,
        service,
        type: 'bus.error',
        circularJSON: CircularJSON.stringify(rest),
      };
      errorDataToEvent(err, errEv);
      graylogSend(errEv, self);
      evStr = CircularJSON.stringify(ev);
    }

    graylog.send(evStr, graylogSendCB);
    if (graylogBackup) {
      graylogBackup.send(evStr, () => {
      });
    }

    if (graylogListeners) {
      graylogListeners.forEach(listener => {
        listener(ev, self);
      })
    }
  }
}

const host = os.hostname();

function wrapEvent(ev) {
  const r = Object.create(null);
  r.timestamp = Date.now() / 1000;
  r.host = host;
  if (this._node) r.node = this._node;
  Object.assign(r, ev);
  return r;
}

function addMessageField(ev, evConfig, alterToStringMap) {

  if (hasOwnProperty.call(ev, 'message')) return ev;

  const alterToStringList = alterToStringMap[ev.type];
  if (alterToStringList) {
    for (const alterToString of alterToStringList) {
      const str = alterToString(ev);
      if (str === undefined) return; // не выводим ничего
      if (typeof str !== 'string') continue; // все что не строка, считаем что надо продолжать искать вариант вывода в консоль
      ev = Object.assign(Object.create(null), ev);
      ev.message = str;
      return ev;
    }
  }
  if (evConfig) {
    if (hasOwnProperty.call(evConfig, 'toString')) {
      const str = evConfig.toString(ev);
      if (str) {
        ev = Object.assign(Object.create(null), ev);
        ev.message = str;
        return ev;
      }
    }
  }
}

function addDefaultMessage(ev) {
  if (hasOwnProperty.call(ev, 'message')) return;
  const {host, timestamp, service, type, ...rest} = ev;
  ev.message = `${service}: ${type}${Object.keys(rest).length > 0 ? ` ${prettyPrint(rest)}` : ''}`;
  return ev;
}

export default function (services = {}) {

  if (!(typeof services === 'object' && services !== null && !Array.isArray(services))) throw new Error(`Invalid argument 'services': ${prettyPrint(services)}`);

  const {
    testMode,
    console = realConsole,
  } = services;

  const validateArgumentEvOptions = {argument: 'ev'};

  const validateRegisterEventEv = validateOptionsFactory({
    type: {type: 'string', required: true},
    kind: {
      type: 'string',
      validate: (fieldName, fieldDef) => function (object, message, options) {
        switch (object.kind) {
          case 'event':
          case 'action':
          case 'method':
          case 'command':
          case 'error':
          case 'warn':
          case 'info':
          case 'debug':
            return;
        }
        (message || (message = [])).push(`Invalid option 'kind': ${prettyPrint(object.kind)}`);
        return message;
      }
    },
    validate: {
      type: 'function',
      null: true,
      validate: (fieldName, fieldDef) => function (object, message, options) {
        const validate = object.validate;
        if (hasOwnProperty.call(validate, 'fields')) return; // у всех методов сделанных через validateOptions, есть свойство fields
        (message || (message = [])).push(`Invalid option 'validate': ${prettyPrint(object.validate)}`);
        return message;
      },
    },
    toString: {type: 'function', null: true},
  });

  function checkEvent(method, ev, config) {
    if (!hasOwnProperty.call(ev, 'type')) throw new Error(`Missing option 'type'`);
    const type = ev.type;
    if (!hasOwnProperty.call(config, type))
      realConsole.warn(logWarn(`Not registered event type '${type}': ${prettyPrint(ev)}`));
    else {
      const evConfig = config[type];
      if (hasOwnProperty.call(evConfig, 'validate'))
        evConfig.validate(ev, validateArgumentEvOptions);
      if (evConfig.kind !== method) realConsole.warn(logWarn(`Event of kind '${evConfig.kind}' reported thru '${method}': ${prettyPrint(ev)}`));
      return evConfig;
    }
  }

  /**
   * Локальная шина обмена сообщений, на основе ndejs emitter'а.  Для того чтобы слушать сообщения надо подписаться на шину
   * через .on метод event emitter'а.  Через Bus идет как обмен сооблщениями внутри javaScript процесса, так и обмен
   * сообщениями с внешней шиной, такой как rabbit.js.  Так же через bus сообщения отправляются в систему логирования данных
   * и на вывод в локальную консоль.
   *
   * При выводе в консоль сообщения, из javascript объекта преобразуются в строку, функциями заданными в BusConfig.
   *
   * Для отправки сообщения можно использовать один из шести методо в зависимости от типа сообщения.  При этом важно помнить,
   * что не все сооблщения подлежать слушанию через event emitter.  Часть сообщений, такие как debug и error уходят только в log
   */
  class Bus extends EventEmitter {

    constructor({nodeName = missingArgument('nodeName'), listeners, color}) {
      super();
      if (!(color === undefined || typeof color === 'boolean')) invalidArgument('color', color);
      if (!(listeners === undefined || listeners === null || Array.isArray(listeners))) invalidArgument('listeners', listeners);

      if (color) {
        const chalk = require('chalk');
        logError = chalk.red;
        logWarn = chalk.yellow;
        logInfo = chalk.blue;
        logEvent = chalk.cyan;
      }

      graylogListeners = listeners;
      this.setMaxListeners(0); // без ограничения
      this._config = Object.create(null);
      this._alterToString = Object.create(null);
      this._index = 0;
      if (nodeName) this._node = nodeName;
      this._clevel = configAPI.has('consoleLevel') ? configAPI.get('consoleLevel') : 100;
      if (configAPI.has('grayLog')) {
        const graylogConfig = configAPI.get('grayLog');
        if (graylogConfig && graylogConfig.enabled) {
          graylog = require('gelf-pro');
          graylog.setConfig(graylogConfig.config);
        }
      }
      // Делаем инстанс для второго канала
      if (configAPI.has('grayLogBackup')) {
        const graylogConfigBackup = configAPI.get('grayLogBackup');
        if (graylogConfigBackup && graylogConfigBackup.enabled) {
          graylogBackup = require('gelf-pro-innervate');
          graylogBackup.setConfig(graylogConfigBackup.config);
        }
      }
      // Добавляем перехват для unhandled rejection
      process.on('unhandledRejection', error => {
        const errEvent = {
          type: 'unhandled.error',
          service: nodeName,
        };
        if (error instanceof Error) {
          error.message = `Unhandled rejection${error.message ? `: ${error.message}` : ''}`;
          errorDataToEvent(error, errEvent);
        } else {
          errEvent.error = {message: `Unhandled rejection without Error object${error ? `: ${error}` : ''}`};
        }
        this.error(errEvent);
      });
    }

    async dispose() {
      return graylogStop();
    }

    /**
     * Регистрирует типы событий.  Описание событий можно передавать как набор аргументов (минимум 1), так и массивами.
     */
    registerEvent() {
      for (const arg of arguments)
        if (Array.isArray(arg))
          for (const ev of arg) this._registerEvent(ev);
        else
          this._registerEvent(arg);
    }

    on(evType, cb) {
      if (testMode && testMode.bus) {
        if (!hasOwnProperty.call(this._config, evType)) realConsole.warn(logWarn(`event of type '${evType}' is not registered`));
      } else {
        if (!hasOwnProperty.call(this._config, evType)) {
          realConsole.warn(logWarn(new Error(`event of type '${evType}' is not registered`).stack));
        }
      }
      super.on(evType, cb);
    }

    /**
     * Регистрация типов сообщений, по одному, массивлм или списком аргументов.
     *
     * Информация о событии содержит:
     * - имя типа (проверяется что он уникальный)
     * - вид сообщения (error, warning, info, debug, event, command)
     * - event валидатор, проверяющий что сообщение содержит допустипую структуру данных
     * - метод формирующий из объекта-event строку для вывода в консоль
     */
    _registerEvent(ev) {
      validateRegisterEventEv(ev, validateArgumentEvOptions);
      const config = this._config;
      if (hasOwnProperty.call(config, ev.type) && config[ev.type] !== ev) throw new Error(`Duplicated event defintion: '${ev.type}'`);
      this._config[ev.type] = ev;
    }

    /**
     * Позволяет переопределить отобржение событий для конкретных event.type.
     *
     * Параметр - map, где ключи тип события, значиние метод, который может вернуть (не обязательно) другой вариант выдачи данных в консоль.
     *
     * Методы которые передаются в map, могут возвращать одно из трех:
     * - undefined - ничего выводит в консоль не надо
     * - строка - то что вывести в консоль, и другие методы не проверять
     * - false - метод не предлагает своего вариант, и потому другие методы и метод toString определнные в событии, должны быть использованы
     */
    alterToString(alterMap = missingArgument('alterMap')) {
      if (!(typeof alterMap === 'object' && alterMap !== null && !Array.isArray(alterMap))) invalidArgument('alterMap', alterMap);
      for (const eventType in alterMap) {
        if (!hasOwnProperty.call(alterMap, eventType)) continue;
        const toString = alterMap[eventType];
        if (!(typeof toString === 'function')) throw new Error(`Argument '${altermap}': Invalid value for key '${eventType}': ${prettyPrint(toString)}`);
        (this._alterToString[eventType] || (this._alterToString[eventType] = [])).push(toString);
      }
    }

    findUnmetAlterToString() {
      let unmetAlterToStrings;
      for (const eventType in this._alterToString)
        if (!(eventType in this._config)) (unmetAlterToStrings || (unmetAlterToStrings = [])).push(eventType);
      if (unmetAlterToStrings) this.warn({
        type: 'bus.unmetAlterToStrings',
        service: 'bus',
        unmetAlterToStrings
      });
    }

    emitEvent(ev) {
      if (testMode && testMode.bus)
        this.emit(ev.type, ev); // в режиме отладки, надо работать без nextTick.  Альтернатива, переопределить nextTick в .test.js
      else
        process.nextTick(() => this.emit(ev.type, ev));
    }

    /**
     * Критическая ошибка, которая может привести к остановке системы.
     */
    criticalError(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('error', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = CRITICAL_ERROR;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (CRITICAL_ERROR <= this._clevel && evm) console.error(logError(evm.message));
      graylogSend(evm || ev, this);
    }

    /**
     * Ошибка в работе кода.
     */
    error(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('error', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = ERROR;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (ERROR <= this._clevel && evm) console.error(logError(evm.message));
      graylogSend(evm || ev, this);
    }

    /**
     * Критическая информация, требующая действия.
     */
    warn(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('warn', ev, this._config);
      ev = wrapEvent.call(this, ev);
      this.emitEvent(ev);
      ev.level = WARN;
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (WARN <= this._clevel && evm) console.warn(logWarn(evm.message));
      graylogSend(evm || ev, this);
    }

    /**
     * Информация о работе системы, для администратора.
     */
    info(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('info', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = INFO;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (INFO <= this._clevel && evm) console.info(logInfo(evm.message));
      graylogSend(evm || ev, this);
    }

    /**
     * То же, что event, но если запущено несколько узлов в одной шине, то это событие передается другим узлам
     */
    action(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('action', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = ACTION;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (ACTION <= this._clevel && evm) console.info(evm.message);
      graylogSend(evm || ev, this);
    }

    /**
     * То же, что event, но если запущено несколько узлов в одной шине, то это событие передается другим узлам
     */
    command(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('command', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = COMMAND;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (COMMAND <= this._clevel && evm) console.info(evm.message);
      graylogSend(evm || ev, this);
    }

    /**
     * Событие в системе, которое можно слушать через bus.on(...)
     */
    event(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('event', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = EVENT;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (EVENT <= this._clevel && evm) console.info(logEvent(evm.message));
      graylogSend(evm || ev, this);
    }

    /**
     * Информация о вызове метода сервиса или graphql.
     */
    method(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('method', ev, this._config);
      ev = wrapEvent.call(this, ev);
      ev.level = METHOD;
      this.emitEvent(ev);
      const evm = addMessageField(ev, evConfig, this._alterToString);
      if (METHOD <= this._clevel && evm) console.info(evm.message);
      graylogSend(evm || ev, this);
    }

    /**
     * Отладочная информация. Для нее не требуется описания события.
     */
    debug(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      ev = wrapEvent.call(this, ev);
      ev.level = DEBUG;
      const evm = addMessageField(ev, undefined, this._alterToString);
      if (DEBUG <= this._clevel && evm) console.debug(evm.message);
      graylogSend(evm || ev, this);
    }
  }

  defineProps(Bus, {
    node: {
      get() {
        return this._node;
      }
    },
    config: {
      get: function () {
        return this._config;
      }
    },
  });

  return Bus;

}
