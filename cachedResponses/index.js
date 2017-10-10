import {missingArgument} from '../validation'
import {oncePerServices} from '../services'

import {validateAndCopyOptionsFactory, validateArgumentNameOptions, VType} from '../validation'

const debug = require('debug')('cached_response');

export const REUSE_RESULT_TIME = 3 * 60 * 1000;
export const REUSE_RESULT_ON_ERROR_TIME = 1 * 60 * 1000;
export const MAX_PARALLEL_REQUESTS = 3;

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  /**
   * Базовый класс для сервисов, которые получают данные по ключу (коду) из внешних систем.  И эти данные можно повторно
   * использовать в течении некоторого времени, без повторных запросов к внешнему сервису.  Так же, чтобы не перегружать
   * внешний сервис, возможно ограничение по количеству одновременных запросов к внешнему сервису.
   */
  class CachedResponsesService {

    _goCount = 0;
    _goQueue = [];

    _cache = {};

    _reuseResultTime = REUSE_RESULT_TIME;
    _reuseResultOnErrorTime = REUSE_RESULT_ON_ERROR_TIME;
    _maxParallelRequests = MAX_PARALLEL_REQUESTS;

    _now = function () {
      (new Date()).getTime();
    };

    constructor(settings) {
      schema.ctor_settings(this, settings);
    }

    /**
     * Смотрит есть ли уже данные в кеш и не прошло ли время, когда надо их обновить.  Если нужно обновить запускает загрузку
     * через функцию getData().  Если функция возвращается с ошибкой - то используется предыдущее значение.  Если загрузка уже
     * началась в другом методе getDataFromCache, то очередная загрузка не стартует, а запрос встает в очередь на ожидание ответа
     * от чужого запроса - promiseValue.await.
     *
     * @returns {Promise}
     * @private
     */
    _find /* async */(args = missingArgument('args')) {
      debug(`_find(%s)`, args);
      const key = this._argsToKey(args);
      let cachedValue = this._cache[key];
      if (cachedValue) {
        if (cachedValue.goodTill >= this._now()) {
          debug('return cached value');
          return Promise.resolve(cachedValue.data);
        }
      } else {
        debug('new cache value');
        this._cache[key] = cachedValue = {key};
      }
      return new Promise((resolve, reject) => {
        if (!cachedValue.hasOwnProperty('await')) {
          debug('queue loading');
          cachedValue.await = this._loadDataQueue(args).then((data) => {
            debug('load succeeded', data);
            delete cachedValue.await;
            cachedValue.data = data; // Сохраняем новое значение
            cachedValue.goodTill = this._now() + this._reuseResultTime;
            return data;
          }, (err) => {
            debug('load failed: %O', err);
            delete cachedValue.await;
            if (cachedValue.hasOwnProperty('data')) {
              cachedValue.goodTill = this._now() + this._reuseResultOnErrorTime;
              return cachedValue.data; // Используем старое значение
            }
            return null;
          });
        }
        resolve(cachedValue.await);
      });
    }

    /**
     * Метод, который запускает следующий в очереди go метод, вне зависимости от успешного или не успешного завершения предыдущего шага.
     */
    _nextGo = (data) => {
      debug('nextGo');
      this._goCount--;
      let next = this._goQueue.shift();
      if (next) next();
      return data;
    };

    _nextGoOnReject = (err) => {
      debug('nextGo');
      this._goCount--;
      let next = this._goQueue.shift();
      if (next) next();
      return Promise.reject(err);
    };

    /**
     * Запускает процесс загрузки данных.  Если есть ограничение по кличеству одновременных операций по загрузке, то ставит
     * очередную загрузку в очередь.
     *
     * @param args Произвольный map аргументов, для операции загрузки.
     * @returns {Promise}
     * @private
     */
    _loadDataQueue(args) {

      if (this._maxParallelRequests < 1) { // нет ограничеия по количеству одновременных загрузок

        return this._load(args);

      } else {

        // всегда возвращает Promise соотвествующий аргументам.  При этом, реальная операция загрузки может попасть в очередь
        return new Promise((resolve, reject) => {
          // метод который запускает реальный процесс загрузки и связывает результат с ранее возвращенным Promise для данных аргументов
          let go = () => {
            debug('go');
            this._goCount++;
            resolve(this._load(args).then(this._nextGo, this._nextGoOnReject));
          };

          if (this._goCount === this._maxParallelRequests)
            this._goQueue.push(go); // в очередь
          else
            go(); // сразу выполняем
        });
      }
    }

    /**
     * Формирует ключ для элемента кеширования, для данных аргументов.
     *
     * @param args
     * @private
     */
    _argsToKey(args = missingArgument('args')) {
      return JSON.stringify(args);
    }

    /**
     * Класс наследник должен переопределить метод, чтоб он загружал данные, в соответствии с переданными аргументами.
     *
     * Даже если данных для данных параметров нет, должен возвращаться пустой результат (не ошибка).
     *
     * @returns {Promise}
     * @private
     */
    async _load(args) {
      throw new Error('not implemented')
    }
  }

  return CachedResponsesService;
})
