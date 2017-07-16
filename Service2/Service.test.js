import test from 'ava'
import path from 'path'
import sinon from 'sinon'

import Service, {
  DEFAULT_RESTART_INTERVAL,

  NOT_INITIALIZED,
  WAITING_OTHER_SERVICES_TO_START,
  INITIALIZING,
  INITIALIZE_FAILED,
  STARTING,
  READY,
  STOPPING,
  STOPPED,
  FAILED,
  DISPOSING,
  DISPOSED,
} from './Service'

let clock;
test.beforeEach(t => {
  clock = sinon.useFakeTimers();
});
test.afterEach(t => {
  clock.restore();
});

test(`На каждый шаг есть _service... метод, и всё идет без ошибок`, async t => {
  let s;
  const svc = Service('testService', s = {
    _serviceInit: () => Promise.delay(100), // не получилось сделать через sinon.stub() - не нашёл как возвращать Promise.delay именно в момент использования метода
    _serviceStart: () => Promise.delay(100),
    _serviceStop: () => Promise.delay(100),
    _serviceDispose: () => Promise.delay(100),
  }, {testMode: true});

  t.not(svc, s); // Service создает новый объект, который использует внутри объект s

  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, NOT_INITIALIZED);

  svc.__nextStateStep();

  t.is(svc._state, INITIALIZING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceInit
  svc.__nextStateStep();

  t.is(svc._state, STOPPED);

  svc.__nextStateStep();

  t.is(svc._state, STARTING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceStart
  svc.__nextStateStep();

  t.is(svc._state, READY);
  t.is(svc._serviceError, null);

  clock.tick(100);
  svc.__nextStateStep();

  t.is(svc._state, READY);
  t.is(svc._serviceError, null);

  svc._stop();
  t.is(svc._state, STOPPING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceStop
  svc.__nextStateStep();

  t.is(svc._state, STOPPED);
  t.is(svc._serviceError, null);

  svc._start();

  t.is(svc._state, STARTING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceStart
  svc.__nextStateStep();

  t.is(svc._state, READY);
  t.is(svc._serviceError, null);

  const disposedPromise = svc._dispose();
  t.is(svc._state, STOPPING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceStop
  svc.__nextStateStep();

  t.is(svc._state, STOPPED);
  t.is(svc._serviceError, null);
  svc.__nextStateStep();

  t.is(svc._state, DISPOSING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceDispose
  svc.__nextStateStep();

  t.is(svc._state, DISPOSED);
  t.is(svc._serviceError, null);
  t.true(disposedPromise.isFulfilled());

  svc._stop(); // если сервис уже disposed, то операции _start и _stop на состояние не влияют
  clock.tick(100);
  svc.__nextStateStep();

  t.is(svc._state, DISPOSED);

  svc._start(); // если сервис уже disposed, то операции _start и _stop на состояние не влияют
  clock.tick(100);
  svc.__nextStateStep();

  t.is(svc._state, DISPOSED);

  t.deepEqual(events, [
    {prevState: NOT_INITIALIZED, state: INITIALIZING},
    {prevState: INITIALIZING, state: STOPPED},
    {prevState: STOPPED, state: STARTING},
    {prevState: STARTING, state: READY},
    {prevState: READY, state: STOPPING},
    {prevState: STOPPING, state: STOPPED},
    {prevState: STOPPED, state: STARTING},
    {prevState: STARTING, state: READY},
    {prevState: READY, state: STOPPING},
    {prevState: STOPPING, state: STOPPED},
    {prevState: STOPPED, state: DISPOSING},
    {prevState: DISPOSING, state: DISPOSED},
  ]);
});

test(`Цикл без методов _serviceInit, ...Start, ...Stop, ...Dispose`, async t => {
  const svc = Service('testService', {});
  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, READY); // временные задержки тут не нужны, так как нет методов которые бы выполнялись некотороое время
  svc._stop();
  t.is(svc._state, STOPPED);
  svc._start();
  t.is(svc._state, READY);
  svc._dispose();
  t.is(svc._state, DISPOSED);

  t.deepEqual(events, [
    {prevState: READY, state: STOPPED},
    {prevState: STOPPED, state: READY},
    {prevState: READY, state: STOPPED},
    {prevState: STOPPED, state: DISPOSED},
  ]);
});

test(`Ошибка при init`, async t => {
  const err = new Error();
  const svc = Service('testService', {
    _serviceInit: () => Promise.reject(err),
  });

  t.is(svc._state, INITIALIZE_FAILED); // так как init не прошёл
  svc._start();
  t.is(svc._state, INITIALIZE_FAILED);
  svc._stop();
  t.is(svc._state, INITIALIZE_FAILED);
  svc._dispose();
  t.is(svc._state, DISPOSED);
});

test(`Ошибка при start и рестарт по времени`, async t => {
  const err = new Error();
  const svc = Service('testService', {
    _serviceStart: () => Promise.delay(100).then(() => Promise.reject(err)),
  });
  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, STARTING);

  clock.tick(100);
  await svc.__testWait();

  t.is(svc._state, FAILED);
  t.is(svc._serviceError, err);

  clock.tick(DEFAULT_RESTART_INTERVAL); // после этого интервала сервис перейдет в состояни stop, из которого попробует рестартовать
  clock.tick(100); // а это чтобы сработал serviceStart метод
  await svc.__testWait();
  // проверка, что через DEFAULT_RESTART_INTERVAL сервиc перешёл в STOPPED, и снова запустил STARTING ниже в проверке events

  t.is(svc._state, FAILED);
  t.is(svc._serviceError, err);

  t.deepEqual(events, [
    {prevState: STARTING, state: FAILED, reason: err},
    {prevState: FAILED, state: STOPPED},
    {prevState: STOPPED, state: STARTING},
    {prevState: STARTING, state: FAILED, reason: err},
  ]);
});

test(`Ошибка при stop`, async t => {
  const err = new Error();
  const svc = Service('testService', {
    _serviceStop: () => Promise.delay(100).then(() => Promise.reject(err)),
  });
  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, READY);

  svc._stop();

  clock.tick(100);
  await svc.__testWait();

  t.is(svc._state, STOPPED); // сервис успешно останавливается
  t.is(svc._serviceError, err); // но ошибка достуна через _serviceError
});

test(`Ошибка при dispose`, async t => {
  const err = new Error();
  const svc = Service('testService', {
    _serviceDispose: () => Promise.delay(100).then(() => Promise.reject(err)),
  });
  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, READY);

  const disposePromise = svc._dispose();

  clock.tick(100);
  await svc.__testWait();

  t.is(svc._state, DISPOSED); // сервис успешно останавливается
  t.is(svc._serviceError, err); // но ошибка достуна через _serviceError
  t.true(disposePromise.isFulfilled()); // не смотря на ошибку, Promise полученный из _dispose разрешается успешно, чтоб не портить картину, когда останавливается список сервисов
});

test.only(`Сервис переходит из состояния READY в FAILED, если вызвать _fireFailure`, async t => {
  const err1 = new Error();
  const err2 = new Error();
  const svc = Service('testService', {
    _serviceStop: () => Promise.delay(100).then(() => Promise.reject(err2)),
    _serviceDispose: () => Promise.delay(100),
  }, {testMode: true});

  const events = [];
  svc._serviceSubscribe((state, prevState, reason) => {events.push({state, prevState, ...(reason ? {reason} : null)});});

  t.is(svc._state, NOT_INITIALIZED);
  svc.__nextStateStep();

  t.is(svc._state, STOPPED);
  svc.__nextStateStep();

  t.is(svc._state, READY);
  svc._fireFailure(err1);

  t.is(svc._state, STOPPING);

  clock.tick(100);
  await svc.__testWait(); // ждем завершение метода _serviceStop
  svc.__nextStateStep();

  t.is(svc._state, FAILED);
  t.is(svc._serviceError, err1);

  // svc.__nextStateStep();
  //
  // t.is(svc._state, DISPOSING);
  //
  // clock.tick(100);
  // await svc.__testWait(); // ждем завершение метода _serviceDispose
  // svc.__nextStateStep();
  //
  // t.is(svc._state, DISPOSED);
});

test.skip(`Из состояния FAILED можно досрочно выйти переведя сервис вызвав _stop, а потом сразу _start`, async t => {

});

test.skip(`При failure в состоянии READY сервис корректно останавливается и переходит в состояние FAILED`, async t => {
});

test.skip(`При failure в состоянии READY сервис, даже если, НЕ корректно останавливается, то всё переходит в состояние FAILED`, async t => {

});

test.skip(`Ожидание запуска сервис от которых сервис зависит`, async t => {
});
test.skip(`Остановка сервиса, если выключился сервис от которого он зависит`, async t => {
});

