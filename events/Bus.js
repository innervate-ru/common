import EventEmitter from 'events'
import {missingArgument, invalidArgument} from '../utils/arguments'
import configAPI from 'config'
import graylog2 from 'graylog2' // TODO: Replace by https://www.npmjs.com/package/gelf-pro OR  https://github.com/robertkowalski/gelf-node
import prettyPrint from '../utils/prettyPrint'
import defineProps from '../utils/defineProps'
import {validateOptionsFactory} from '../validation/validateObject'

const hasOwnProperty = Object.prototype.hasOwnProperty;
const defaultConsole = console;

export default function (services = {}) {

  if (!(typeof services === 'object' && services != null && !Array.isArray(services))) throw new Error(`Invalid argument 'services': ${prettyPrint(services)}`);

  const {
    testMode,
    console = defaultConsole,
  } = services;

  const validateArgumentEvOptions = {argument: 'ev', console};

  const validateRegisterEventEv = validateOptionsFactory({
    type: {type: 'string', required: true},
    kind: {
      type: 'string',
      validate: (fieldName, fieldDef) => function (object, message, options) {
        switch (object.kind) {
          case 'event':
          case 'command':
          case 'info':
          case 'error':
          case 'warn':
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
      console.warn(`Not registered event type '${type}': ${prettyPrint(ev)}`);
    else {
      const evConfig = config[type];
      if (hasOwnProperty.call(evConfig, 'validate'))
        evConfig.validate(ev, validateArgumentEvOptions);
      if (evConfig.kind !== method) console.warn(`Event of kind '${evConfig.kind}' reported thru '${method}': ${prettyPrint(ev)}`);
      return evConfig;
    }
  }

  function logEvent(method, ev, evConfig, alterToStringMap) {
    const alterToStringList = alterToStringMap[ev.type];
    if (alterToStringList) {
      for (const alterToString of alterToStringList) {
        const str = alterToString(ev);
        if (str === undefined) return; // не выводим ничего
        if (typeof str !== 'string') continue; // все что не строка, считаем что надо продолжать искать вариант вывода в консоль
        console[method](str);
        return;
      }
    }
    if (evConfig) {
      if (hasOwnProperty.call(evConfig, 'toString')) {
        const str = evConfig.toString(ev);
        if (str) console[method](str);
        return;
      }
    }
    console[method](prettyPrint(ev));
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

    constructor() {
      super();
      this.setMaxListeners(0); // без ограничения
      this._config = Object.create(null);
      this._alterToString = Object.create(null);

      const loggerConfig = configAPI.get('grayLog');
      if (loggerConfig.enabled) {
        this._logger = new graylog2.graylog(loggerConfig);
      }
    }

    async dispose() {
      if (this._logger) {
        return new Promise((resolve, reject) => {
          this._logger.close(() => resolve());
        });
      }
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
      if (testMode) {
        if (!hasOwnProperty.call(this._config, evType)) console.warn(`event of type '${evType}' is not registered`);
      } else {
        if (!hasOwnProperty.call(this._config, evType)) {
          console.warn((new Error(`event of type '${evType}' is not registered`)).stack);
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
      if (!(typeof alterMap === 'object' && alterMap != null && !Array.isArray(alterMap))) invalidArgument('alterMap', alterMap);
      for (const eventType in alterMap) {
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
        time: new Date().getTime(),
        type: 'bus.unmetAlterToStrings',
        source: 'bus',
        unmetAlterToStrings
      });
    }

    // TODO: Подумать о добавлении вида событий stat, для хранения статистики работы приложения.  Так как я решил, что info не будет писаться в log - оно для передачи данных между компонентами

    event(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('event', ev, this._config);
      logEvent('info', ev, evConfig, this._alterToString);
      this.emit(ev.type, ev);
      this._logger && this._logger.info(ev);
    }

    command(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('command', ev, this._config);
      logEvent('info', ev, evConfig, this._alterToString);
      this.emit(ev.type, ev);
      this._logger && this._logger.info(ev);
    }

    info(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('info', ev, this._config);
      logEvent('info', ev, evConfig, this._alterToString);
      this.emit(ev.type, ev);
      this._logger && this._logger.info(ev);
    }

    error(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('error', ev, this._config);
      logEvent('error', ev, evConfig, this._alterToString);
      this._logger && this._logger.error(ev);
    }

    warn(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('warn', ev, this._config);
      logEvent('warn', ev, evConfig, this._alterToString);
      this._logger && this._logger.warning(ev);
    }

    debug(ev) {
      if (!(arguments.length === 1)) throw new Error(`Invalid number of arguments: ${prettyPrint(arguments)}`);
      const evConfig = checkEvent('debug', ev, this._config);
      this._logger && this._logger.debug(ev);
    }
  }

  defineProps(Bus, {
    config: {
      get: function () {
        return this._config;
      }
    },
  });

  return Bus;

}
