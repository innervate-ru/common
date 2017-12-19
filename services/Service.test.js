import test from 'ava'
import sinon from 'sinon'
import TestConsole from '../utils/testConsole'
import {DEFAULT_FAIL_RECOVERY_INTERVAL} from './Service'
import {
  NOT_INITIALIZED,
  WAITING_OTHER_SERVICES_TO_START_OR_FAIL,
  INITIALIZING,
  INITIALIZE_FAILED,
  STARTING,
  READY,
  STOPPING,
  STOPPED,
  FAILED,
  DISPOSING,
  DISPOSED
} from './Service.states'

// ВНИМАНИЕ: Налетел на проблему, что тесты валятся когда работают вместе и используют sinon.useFakeTimers().  Поэтому тесты надо запускать в режиме serial.
test.beforeEach(t => {
  t.context.clock = sinon.useFakeTimers();
});
test.afterEach(t => {
  t.context.clock.restore();
});

// TODO: Добавить в событие, сколько времени занимала операция
// TODO: Информация для монитора: какое время сервис находится в состоянии, причины почему он не может быть запусщен
// TODO: Методанные - команды которые можно выполнить на сервисе

// опредления пустных сервисов для тестирования.  при этом s2 зависит от s1, а s3 от s1 и s2
test.beforeEach(t => {
  [t.context.s1, t.context.s2, t.context.s3] = [1, 2, 3].map(i => {
    const name = `s${i}`;
    return {
      name,
      default: (services) => {
        const dependsOn = [];
        for (let j = 1; j < i; j++) dependsOn.push(services[`s${j}`]);
        return new (require('./index').Service(services)(class DummyService {
          // nothing
        }))(name, {dependsOn})
      },
    }
  });
});

test.serial(`Запуск без dependsOn`, t => {
  const services = {console: new TestConsole(), testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [t.context.s1],
  });
  const s1 = nodeManager.services.s1._service;
  t.is(s1.state, NOT_INITIALIZED);
  s1._nextStateStep();
  t.is(s1.state, STOPPED);
  s1._nextStateStep();
  t.is(s1.state, READY);
  s1.stop();
  t.is(s1.state, STOPPED);
  s1.dispose();
  t.is(s1.state, DISPOSED);

  // TODO: Почитать bus
});

test.serial(`Запуск с dependsOn`, t => {
  try {
    const testConsole = new TestConsole();
    const services = {console: testConsole, testMode: {bus: true, service: true}};
    services.bus = new (require('../events').Bus(services))();
    const nodeManager = new (require('./index').NodeManager(services))({
      name: 'node1',
      services: [t.context.s1, t.context.s2, t.context.s3],
    });
    const s1 = nodeManager.services.s1._service;
    const s2 = nodeManager.services.s2._service;
    const s3 = nodeManager.services.s3._service;

    // нет зависимости от других сервисов
    t.is(s1._isAllDependsAreReady, true);

    // зависимость от одного сервиса
    t.is(s1.state, NOT_INITIALIZED);
    t.is(s2.state, NOT_INITIALIZED);
    t.is(s3.state, NOT_INITIALIZED);
    t.is(s2._isAllDependsAreReady, false);
    s1._nextStateStep();
    t.is(s1.state, STOPPED);

    s1._nextStateStep();
    t.is(s1.state, READY);

    t.true(s2._isAllDependsAreReady);

    s1.stop(); // -> STOPPED
    t.is(s2._isAllDependsAreReady, false);
    s2._nextStateStep();
    t.is(s2.state, STOPPED);
    s2._nextStateStep();
    t.is(s2._isAllDependsAreReady, false);
    t.is(s2.state, STOPPED);
    s1.start();
    t.is(s2._isAllDependsAreReady, true);
    t.is(s2.state, READY);
    s1.stop();
    s2.stop();

    // зависимость от двух сервисов
    t.is(s1.state, STOPPED);
    t.is(s2.state, STOPPED);
    t.is(s3.state, STOPPED); // сервис подписан на события других сервисов, и потом перешёл в STOPPED
    t.is(s3._isAllDependsAreReady, false);
    s1.start(); // -> READY
    t.is(s3._isAllDependsAreReady, false);
    s2.start(); // -> READY
    t.is(s3._isAllDependsAreReady, true);
    s3._nextStateStep(); // -> READY
    t.is(s3.state, READY);
    s2.stop();
    t.is(s3.state, STOPPED);
    s2.start();
    t.is(s3.state, READY);
    s1.stop();
    t.is(s2.state, STOPPED);
    t.is(s3.state, STOPPED);
    s1.start();
    t.is(s2.state, READY);
    t.is(s3.state, READY);
  } catch (err) {
    console.error('err', err);
  }
});

test.serial(`Фатальная ошибка при работе сервиса, требуещая остановки.  Перезапуск сервиса по времени`, t => {
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  require('./Service.events').default(services);
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [t.context.s1],
  });
  const s1 = nodeManager.services.s1._service;
  s1._nextStateStep(); // -> STOPPED
  s1._nextStateStep(); // -> READY

  t.is(s1.state, READY);
  t.is(s1.failureReason, null);

  testConsole.getLogAndClear(); // очищаем предыдущие сообщения

  s1.criticalFailure(new Error('some error'));

  t.is(s1.state, FAILED);
  t.is(s1.failureReason.message, 'some error');

  try {
    t.is(testConsole.getLogAndClear(),
      `error: node1:s1: error: 'Error: some error' | ` +
      `info: node1:s1: state: 'failed' (reason: 'Error: some error')`);
  } catch (err) {
    console.error(err);
  }

  t.context.clock.tick(DEFAULT_FAIL_RECOVERY_INTERVAL / 2);

  s1._nextStateStep(); // -> FAILED, время ещё не прошло

  t.is(s1.state, FAILED);
  t.is(s1.failureReason.message, 'some error');

  t.context.clock.tick(DEFAULT_FAIL_RECOVERY_INTERVAL / 2 + 100);

  t.is(s1.state, STOPPED);
  t.is(s1.failureReason, null);

  s1._nextStateStep(); // -> READY

  t.is(s1.state, READY);
});

test.serial(`Переходы сообщений с ожиданием исполнения асинхронных методов`, async t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceInit() {
          return Promise.delay(100);
        }
        _serviceStart() {
          return Promise.delay(100);
        }
        _serviceStop() {
          return Promise.delay(100);
        }
        _serviceDispose() {
          return Promise.delay(100);
        }
      }))(name)
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [svcS],
  });
  const s = nodeManager.services.s._service;

  t.is(s.state, NOT_INITIALIZED);
  s._nextStateStep();

  t.is(s.state, INITIALIZING);

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  // await s._testWaitPromise; // тут не нужен - это для случаев когда Promise резолвится не по таймеру
  s._nextStateStep();
  t.is(s.state, STOPPED);

  s._nextStateStep();
  t.is(s.state, STARTING);

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  s._nextStateStep();
  t.is(s.state, READY);

  s.stop(); // теперь останавливаем
  t.is(s.state, STOPPING);

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  s._nextStateStep();
  t.is(s.state, STOPPED);

  const disposePromise = s.dispose();
  t.is(s.state, DISPOSING);
  t.false(disposePromise.isFulfilled());

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  s._nextStateStep();
  t.is(s.state, DISPOSED);
  t.true(disposePromise.isFulfilled());
});

test.serial(`Ошибка в асинхронном методе - при инициализации`, async t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceInit() {
          return new Promise(function (resolve, reject) {
            setTimeout(() => reject(new Error('some error')), 100);
          });
        }
      }))(name)
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [svcS],
  });
  const s = nodeManager.services.s._service;

  t.is(s.state, NOT_INITIALIZED);
  s._nextStateStep();

  t.is(s.state, INITIALIZING);

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  await (s._testWaitPromise.catch(() => true)); // через catch заменяем ошибку, на результат - чтоб тест не сыпался
  s._nextStateStep();
  t.is(s.state, INITIALIZE_FAILED);

  // если возникла ошибка при инициализации, то stop/start на неё не влияют
  s.stop();
  t.is(s.state, INITIALIZE_FAILED);

  s.start();
  t.is(s.state, INITIALIZE_FAILED);

  t.is(s.failureReason.message, 'some error'); // ошибка остается в данных сервиса после start/stop

  t.context.clock.tick(100000);

  t.is(s.failureReason.message, 'some error'); // ошибка не сбрасывается по таймеру

  const disposePromise = s.dispose();
  t.is(s.state, DISPOSED);
  t.true(disposePromise.isFulfilled());
});

test.serial(`Ошибка в асинхронном методе - при запуске`, async t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceStart() {
          return new Promise(function (resolve, reject) {
            setTimeout(() => reject(new Error('some error')), 100);
          });
        }
      }))(name)
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [svcS],
  });
  const s = nodeManager.services.s._service;

  t.is(s.state, NOT_INITIALIZED);

  s._nextStateStep();
  t.is(s.state, STOPPED);

  s._nextStateStep();
  t.is(s.state, STARTING);

  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  await (s._testWaitPromise.catch(() => true)); // через catch заменяем ошибку, на результат - чтоб тест не сыпался
  s._nextStateStep();
  t.is(s.state, FAILED);
  t.is(s.failureReason.message, 'some error');

  t.context.clock.tick(DEFAULT_FAIL_RECOVERY_INTERVAL + 100);
  t.is(s.state, STOPPED);
  t.is(s.failureReason, null);

  // заодно протестируем, что если в процессе STARTING будет stop, то после ошибки, сервис сразу через FAILED перейдет в STOPPED
  s._nextStateStep();
  t.is(s.state, STARTING);

  s.stop();

  t.context.clock.tick(200);
  await (s._testWaitPromise.catch(() => true));
  s._nextStateStep();
  t.is(s.state, FAILED);
  t.is(s.failureReason.message, 'some error');

  s._nextStateStep();
  t.is(s.state, STOPPED);
  t.is(s.failureReason, null);
});

test.serial(`Ошибка в асинхронном методе - при остановке`, async t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceStop() {
          return new Promise(function (resolve, reject) {
            setTimeout(() => reject(new Error('some error')), 100);
          });
        }
      }))(name)
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  require('./Service.events').default(services);
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [svcS],
  });
  const s = nodeManager.services.s._service;

  t.is(s.state, NOT_INITIALIZED);

  s._nextStateStep();
  t.is(s.state, STOPPED);

  s._nextStateStep();
  t.is(s.state, READY);

  s.stop();
  t.is(s.state, STOPPING);

  testConsole.getLogAndClear(); // удаляем предыдущие сообщения
  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  await (s._testWaitPromise.catch(() => true)); // через catch заменяем ошибку, на результат - чтоб тест не сыпался
  s._nextStateStep();
  t.is(s.state, STOPPED);
  t.is(s.failureReason, null); // ошибки при остановке, не считаются критическими проблемами для сервиса

  // TODO: Разобраться что за контекст появился в ошибке
  // t.is(testConsole.getLogAndClear(), // но ошибка ушла в bus
  //   `error: node1:s: error: 'Error: some error' | ` +
  //   `info: node1:s: state: 'stopped'`
  // );

});

test.serial(`Ошибка в асинхронном методе - при дестрое`, async t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceDispose() {
          return new Promise(function (resolve, reject) {
            setTimeout(() => reject(new Error('some error')), 100);
          });
        }
      }))(name)
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  require('./Service.events').default(services);
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [svcS],
  });
  const s = nodeManager.services.s._service;

  t.is(s.state, NOT_INITIALIZED);

  s._nextStateStep();
  t.is(s.state, STOPPED);

  const disposePromise = s.dispose();
  t.is(s.state, DISPOSING);
  t.false(disposePromise.isFulfilled());

  testConsole.getLogAndClear(); // удаляем предыдущие сообщения
  t.context.clock.tick(200); // ждем чтоб Promise разрезолвился по таймеру
  await (s._testWaitPromise.catch(() => true)); // через catch заменяем ошибку, на результат - чтоб тест не сыпался
  s._nextStateStep();
  t.is(s.state, DISPOSED);
  t.true(disposePromise.isFulfilled());
  t.is(s.failureReason, null); // ошибки при остановке, не считаются критическими проблемами для сервиса
  t.is(testConsole.getLogAndClear(), // но ошибка ушла в bus
    `error: node1:s: error: 'Error: some error' | ` +
    `info: node1:s: state: 'disposed'`
  );
});

test.serial(`Ожидание в статусе WAITING_OTHER_SERVICES_TO_START_OR_FAIL пока сервис от которого есть зависимость стартанет. Остановка сервиса после STARTING, если сервис от которого он зависи остановился`, t => {
  const name = 's';
  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceInit() {
          return Promise.delay(100);
        }
        _serviceStart() {
          return Promise.delay(100);
        }
      }))(name, {dependsOn: [services.s1]})
    },
  };
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [t.context.s1, svcS],
  });
  const s1 = nodeManager.services.s1._service;
  const s = nodeManager.services.s._service;

  t.is(s1.state, NOT_INITIALIZED);
  t.is(s.state, NOT_INITIALIZED);

  t.false(s._isAllDependsAreReady);
  s._nextStateStep();
  t.is(s1.state, NOT_INITIALIZED);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL); // ждем червис s1

  s1._nextStateStep();
  t.is(s1.state, STOPPED);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL);

  s1._nextStateStep();
  t.is(s1.state, READY);
  t.is(s.state, INITIALIZING);

  t.context.clock.tick(200);
  s._nextStateStep();
  t.is(s1.state, READY);
  t.is(s.state, STOPPED);

  s._nextStateStep();
  t.is(s1.state, READY);
  t.is(s.state, STARTING);

  s1.stop(); // останавливаем сервис, что должно после запуска s1, сразу отправить его в STOPPED
  t.is(s1.state, STOPPED);
  t.is(s.state, STARTING);

  t.context.clock.tick(200); // дожидаемся завершения _serviceStart()

  s._nextStateStep();
  t.is(s1.state, STOPPED);
  t.is(s.state, STOPPED);

  s1.start(); // снова запускаем сервис s1, и это тут же начинает запуск сервиса s
  t.is(s1.state, READY);
  t.is(s.state, STARTING);

  t.context.clock.tick(200);
  s._nextStateStep();
  t.is(s1.state, READY);
  t.is(s.state, READY);

});

// TODO: Check failed init, and kill whole app if some service had failed
// TODO: Додумать и реализовать как должны стартовать сервисы, у которых сервисы от которых они зависят, не запустились и сразу перешли в состояние FAILED
test.serial.skip(`Ожидание в статусе WAITING_OTHER_SERVICES_TO_START_OR_FAIL пока сервис от которого есть зависимость перейдет в FAILED при запуске.  И этот сервис переходит в STOPPED`, async t => {

  const name = 's';
  const failingToStartSvcDecl = {
    name: 'failingService',
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceStart() {
          return new Promise(function (resolve,  reject) {
            setTimeout(() => reject(new Error(`some error`), 100));
          });
        }
      }))(name, {dependsOn: []})
    },
  };

  const svcS = {
    name,
    default: (services) => {
      return new (require('./index').Service(services)(class DummyService {
        _serviceInit() {
          return Promise.delay(100);
        }
        _serviceStart() {
          return Promise.delay(100);
        }
      }))(name, {dependsOn: [services.failingService, services.s1]})
    },
  };

  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();

  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [failingToStartSvcDecl, t.context.s1, svcS],
  });

  const failingService = nodeManager.services.failingService._service;
  const s1 = nodeManager.services.s1._service;
  const s = nodeManager.services.s._service;

  t.is(failingService.state, NOT_INITIALIZED);
  t.is(s1.state, NOT_INITIALIZED);
  t.is(s.state, NOT_INITIALIZED);

  t.false(s._isAllDependsAreReady);
  s._nextStateStep();
  t.is(failingService.state, NOT_INITIALIZED);
  t.is(s1.state, NOT_INITIALIZED);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL); // ждем сервис s1

  s1._nextStateStep();
  failingService._nextStateStep();
  t.is(s1.state, STOPPED);
  t.is(failingService.state, STOPPED);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL);

  s1._nextStateStep();
  t.is(s1.state, READY);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL);

  failingService._nextStateStep();
  t.is(failingService.state, STARTING);
  t.is(s.state, WAITING_OTHER_SERVICES_TO_START_OR_FAIL);

  t.context.clock.tick(200);
  try {
    await failingService._testWaitPromise;
    t.fail(`failingService._serviceStart должен вернуть ошибку`)
  } catch (err) { }
  failingService._nextStateStep();
  t.is(failingService.state, FAILED);

  s._nextStateStep();
  t.is(s.state, STOPPED);

  failingService._nextStateStep();
});

test.serial(`dispose NodeManager, с ожиданием когда все сервисы выполнят dispose, или наступит timeout`, async t => {
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [t.context.s1, t.context.s2, t.context.s3],
  });
  const s1 = nodeManager.services.s1._service;
  const s2 = nodeManager.services.s2._service;
  const s3 = nodeManager.services.s3._service;

  s1._callNextStateStep(); // -> STOPPED
  t.is(s1.state, STOPPED);
  s1._callNextStateStep(); // -> READY
  t.is(s1.state, READY);
  t.is(s2.state, STOPPED); // s2._callNextStateStep() не нужен, так как он происходит из-за того что s2 зависит от s1
  s2._callNextStateStep(); // -> READY
  t.is(s3.state, STOPPED); // s3._callNextStateStep() не нужен, так как он происходит из-за того что s3 зависит от s1 и s2
  s3._callNextStateStep(); // -> READY
  t.is(s2.state, READY);
  t.is(s3.state, READY);

  const disposePromise = nodeManager.dispose();

  t.false(disposePromise.isFulfilled());

  t.is(s1.state, STOPPED); // s1._callNextStateStep() не нужен, этот переход был сделан когда nodeManager.dispose() вызвал dispose() у сервиса
  s1._callNextStateStep(); // -> DISPOSED
  t.is(s1.state, DISPOSED);
  s2._callNextStateStep(); // -> DISPOSED

  t.false(disposePromise.isFulfilled());

  s3._callNextStateStep(); // -> DISPOSED

  t.is(s1.state, DISPOSED);
  t.is(s2.state, DISPOSED);
  t.is(s3.state, DISPOSED);

  await disposePromise;
  t.true(true);
});

test.serial(`вызов criticalFailure можно вызывать только  в состоянии READY`, async t => {
  const testConsole = new TestConsole();
  const services = {console: testConsole, testMode: {bus: true, service: true}};
  services.bus = new (require('../events').Bus(services))();
  const nodeManager = new (require('./index').NodeManager(services))({
    name: 'node1',
    services: [t.context.s1],
  });
  const s1 = nodeManager.services.s1._service;

  t.is(s1.state, NOT_INITIALIZED);
  t.throws(() => s1.criticalFailure(new Error(`some error`)), `Critical error thrown in wrong state '${NOT_INITIALIZED}': '{name: 'Error', message: 'some error'}'`);

  s1._callNextStateStep();
  t.is(s1.state, STOPPED);
  t.throws(() => s1.criticalFailure(new Error(`some error`)), `Critical error thrown in wrong state '${STOPPED}': '{name: 'Error', message: 'some error'}'`);

  s1._callNextStateStep();
  t.is(s1.state, READY);
  s1.criticalFailure(new Error(`some error`));

  t.is(s1.state, FAILED);
  t.throws(() => s1.criticalFailure(new Error(`some error`)), `Critical error thrown in wrong state '${FAILED}': '{name: 'Error', message: 'some error'}'`);

  s1.dispose();
  t.is(s1.state, DISPOSED);
  t.throws(() => s1.criticalFailure(new Error(`some error`)), `Critical error thrown in wrong state '${DISPOSED}': '{name: 'Error', message: 'some error'}'`);
});

test.todo(`Сбор данных для монитора`);
test.todo(`Выполнение команд с монитора`);

test.todo(`сервис логирует свою конфигурацию при старте`); // надо подумать когда это правильно сделать ...теоретически конфигурация может меняться через консоль при перезапуске сервиса

test.todo(`смена конфигурации сервиса`); // нужна ли переинициализация
test.todo(`ошибка если асинхронные методы возвращают не promise`); // нужна ли переинициализация
