import test from 'ava'
import testPromise from './testPromise'

import readAheadQueue from './readAheadQueue'

test(`все блоки подгружаются раньше того как их получили из next()`, async t => {

  const promises = [];
  for (let i = 0; i < 6; i++) {
    const t = testPromise();
    promises.push(t);
    t.resolve({index: i});
  }
  const res = promises.map(v => v.promise);

  const next = readAheadQueue({
    length: 3,
    func: function () {
      if (res.length) return res.shift();
    },
  });

  for (let i = 0; i < 6; i++) {
    t.deepEqual(await next(), {index: i});
  }

  t.is(await next(), undefined);

  t.is(await next(), undefined);
});

test(`все блоки подгружаются, после того как их получили из next()`, async t => {

  const promises = [];
  for (let i = 0; i < 6; i++) {
    promises.push(testPromise());
  }
  const res = promises.map(v => v.promise);

  const next = readAheadQueue({
    length: 3,
    func: function () {
      if (res.length) return res.shift();
    },
  });

  for (let i = 0; i < 6; i++) {

    const p = next();

    t.is(p.isFulfilled(), false);

    promises[i].resolve({index: i});

    t.deepEqual(await p, {index: i});
  }

  t.is(await next(), undefined);

  t.is(await next(), undefined);
});

test(`Запрос второго блока, когда ещё первый не загрузился`, async t => {

  const {promise, resolve} = testPromise()

  const next = readAheadQueue({
    length: 3,
    func: async function () {
      return promise;
    },
  });

  await next();

  await t.throws(() => {
    next();
  }, ``);

});

test(`func вопрозвращает не promise и не undefined`, async t => {

  const next = readAheadQueue({
    length: 3,
    func: function () {
      return false;
    },
  });

  await t.throws(next(), `'func' must return eitehr a Promise or undefined: false`);

});

test(`func вопрозвращает не promise и не undefined, при последующих вызовах`, async t => {

  const {promise: promise1, resolve: resolve1} = testPromise();
  const {promise: promise2, resolve: resolve2} = testPromise();
  const {promise: promise3, resolve: resolve3} = testPromise();
  resolve1({index: 1});
  resolve2({index: 2});
  resolve3({index: 3});

  const res = [promise1, promise2, promise3];

  const next = readAheadQueue({
    length: 3,
    func: function () {
      if (res.length) return res.shift();
    },
  });

  t.deepEqual(await next(), {index: 1});

  t.deepEqual(await next(), {index: 2});

  t.deepEqual(await next(), {index: 3});

  await t.throws(next(), `'func' must return eitehr a Promise or undefined: false`);
});

test.todo(`Ошибка при загрузке блока`);

