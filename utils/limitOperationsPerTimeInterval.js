import {invalidArgument, missingArgument} from "./arguments";

/**
 * Цель - нужно ограничить количество вызовов в единицу времени.  Например, чтобы не перегражать БД в которую идет
 * запись данных.
 *
 * @param func  Функция, которая будет вызываться с папаметрами и this, передаваемыми в функцию результат этой функции
 * @param maxPerInterval Максимальное количество вызовов func, в течении указанного интервала времени
 * @param interval Интервал времени, в ms
 * @returns {*} Функция, которая вызывает func с указанными параметрами и this
 */
export default function limitOperationsPerTimeInterval({
                                                         maxPerInterval,
                                                         interval,
                                                         onError = missingArgument('onError'),
                                                       }) {

  if (typeof onError !== 'function') invalidArgument('onError', onError);
  if (!maxPerInterval) {
    return function immutableSetFunc({func = missingArgument('func')}) {
      if (typeof func !== 'function') invalidArgument('func', func);
      return func;
    }
  }
  if (typeof maxPerInterval !== 'number' && maxPerInterval > 0) invalidArgument('maxPerInterval', maxPerInterval);
  if (typeof interval !== 'number' && interval > 0) invalidArgument('interval', interval);

  const times = [];
  const queue = [];
  let timer;

  return function setFunc({
                     func = missingArgument('func'),
                   }) {
    if (typeof func !== 'function') invalidArgument('func', func);

    return function call() {

      const args = arguments;

      const self = this;

      const res = new Promise(function (resolve, reject) {
        queue.push(function () {
          func.apply(self, args)
            .then(resolve)
            .catch(reject)
            .then(next, next);
        });
      });

      next();

      return res;
    };
  }

  function next() {

    try {

      if (queue.length === 0) return;

      if (times) {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        let v;
        if (times.length === maxPerInterval && (v = Date.now() - times[maxPerInterval - 1]) < interval) {
          timer = setTimeout(next, interval - v);
          return;
        }
      }

      times.unshift(Date.now());
      if (times.length > maxPerInterval) times.length = maxPerInterval;

      const queuedFunc = queue.shift();

      queuedFunc();
    } catch (err) {
      onError(err);
    }
  }

}
