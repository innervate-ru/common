import test from 'ava'
import sinon from 'sinon'
import testPromise from '../utils/testPromise'

import limitOperationsPerTimeInterval from './limitOperationsPerTimeInterval'

// переходим на логическое время
test.beforeEach(async t => {
  // использование sinon.useFakeTimers вырубает .timeout(...) в Promise и для ava тестов, потому нужен собственный метод, который работает с настоящим setTimeout
  // и за одно создаем t.context.promiseErrorHandler, который надо добавлять в виде .catch(t.context.promiseErrorHandler) в вызовы async методов, которые вызываются без await
  const realSetTimeout = setTimeout;
  const realClearTimeout = clearTimeout;
  const {promise: errorPromise, resolve: errorResolve} = testPromise();
  t.context.promiseErrorHandler = errorResolve;
  t.context.awaitWithTimeout = (promise) => {
    return new Promise((resolve, reject) => {
      const timer = realSetTimeout(() => {
        reject(new Error('too long'));
      }, 5000);
      const onError = (err) => {
        realClearTimeout(timer);
        reject(err)
      };
      errorPromise.then(onError);
      promise.then((res) => {
        realClearTimeout(timer);
        resolve(res);
      }, onError);
    });
  };

  t.context.clock = sinon.useFakeTimers();
});

test(`базовый тест`, async t => {

  const promises = [0, 1, 2, 3, 4, 5].map(v => testPromise());

  const next = limitOperationsPerTimeInterval({
    func: function (promise) { return promise; },
    maxPerInterval: 3,
    interval: 1000,
    onError: err => { console.error(err); },
  });

  const f0 = next(promises[0].promise);
  const f1 = next(promises[1].promise);
  const f2 = next(promises[2].promise);
  const f3 = next(promises[3].promise);
  const f4 = next(promises[4].promise);
  const f5 = next(promises[5].promise);

  t.is(f0.isFulfilled(), false);
  t.is(f1.isFulfilled(), false);
  t.is(f2.isFulfilled(), false);
  t.is(f3.isFulfilled(), false);

  promises[0].resolve(1);
  promises[1].reject(new Error('2'));
  promises[2].resolve(3);
  promises[3].resolve(4);

  t.is(await t.context.awaitWithTimeout(f0), 1);
  await t.throws(t.context.awaitWithTimeout(f1), '2');
  t.is(await t.context.awaitWithTimeout(f2), 3);

  t.is(f0.isFulfilled(), true);
  t.is(f1.isRejected(), true);
  t.is(f2.isFulfilled(), true);
  t.is(f3.isFulfilled(), false);

  t.context.clock.tick(1000);

  t.is(await t.context.awaitWithTimeout(f3), 4);

  t.is(f3.isFulfilled(), true);
  t.is(f4.isFulfilled(), false);
  t.is(f5.isFulfilled(), false);

  promises[4].reject(new Error('5'));
  promises[5].reject(new Error('6'));

  await t.throws(t.context.awaitWithTimeout(f5), '6');
  await t.throws(t.context.awaitWithTimeout(f4), '5');

});
