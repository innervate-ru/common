import test from 'ava'
import prettyPrint from '../utils/prettyPrint'
import {validateEventFactory, validateAndCopyOptionsFactory, validateOptionsFactory} from '../validation/validateObject'
import {BaseEvent} from './index'
import TestConsole from '../utils/testConsole'

test(`регистрация типов сообщений`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole});
  const bus = new Bus();

  bus.registerEvent({
    type: 'source.event',
    kind: 'event',
    validate: validateEventFactory({
      _extends: BaseEvent,
      val: {time: 10, type: 'int'},
    }),
    toString: ev => `Message for console: ${prettyPrint(ev.val)}`,
  });

  bus.event({time: 10, type: 'source.event', val: 12});
  t.is(testConsole.getLogAndClear(), `info: Message for console: 12`);

  bus.event({time: 10, type: 'source.event', invalid: 321});
  t.is(testConsole.getLogAndClear(), `warn: Event {time: 10, type: 'source.event', invalid: 321}: Unexpected field 'invalid': 321 | info: Message for console: undefined`);

  bus.event({time: 10, type: 'wrong.type', data: 123});
  t.is(testConsole.getLogAndClear(), `warn: Not registered event type 'wrong.type': {time: 10, type: 'wrong.type', data: 123} | info: {time: 10, type: 'wrong.type', data: 123}`);
});

test(`типы событий можно регистрировать по одному, массивом или списком параметров`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole});

  const ev1 = {
    type: 'source.event1',
    kind: 'event',
  };

  const ev2 = {
    type: 'source.event2',
    kind: 'event',
  };

  const bus1 = new Bus();
  bus1.registerEvent(ev1);
  t.is(bus1._config[ev1.type], ev1);
  t.is(bus1._config[ev2.type], undefined);

  const bus2 = new Bus();
  bus2.registerEvent([ev1, ev2]);
  t.is(bus2._config[ev1.type], ev1);
  t.is(bus2._config[ev2.type], ev2);

  const bus3 = new Bus();
  bus3.registerEvent(ev1, ev2);
  t.is(bus3._config[ev1.type], ev1);
  t.is(bus3._config[ev2.type], ev2);
});

test(`сообщение без validate`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole});
  const bus = new Bus();

  bus.registerEvent({
    type: 'source.event',
    kind: 'event',
    toString: ev => `Message for console: ${prettyPrint(ev.val)}`,
  });

  bus.event({time: 10, type: 'source.event', val: 12});
  t.is(testConsole.getLogAndClear(), `info: Message for console: 12`);
});

test(`сообщение без toString`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole});
  const bus = new Bus();

  bus.registerEvent({
    type: 'source.event',
    kind: 'event',
    validate: validateEventFactory({
      _extends: BaseEvent,
      val: {time: 10, type: 'int'},
    }),
  });

  bus.event({time: 10, type: 'source.event', val: 12});
  t.is(testConsole.getLogAndClear(), `info: {time: 10, type: 'source.event', val: 12}`);
});

const kinds = [
  {kind: 'event', console: 'info'},
  {kind: 'command', console: 'info'},
  {kind: 'info', console: 'info'},
  {kind: 'error', console: 'error'},
  {kind: 'warn', console: 'warn'},
  {kind: 'debug', console: null},
];
kinds.forEach(({kind, console: consoleMethod}, i) => {
  test(`сообщение выводимое с неверным kind: '${kind}'`, t => {
    const testConsole = new TestConsole();
    const Bus = require('./bus').default({console: testConsole});
    const bus = new Bus();

    const nextKind = kinds[(i + 1) === kinds.length ? 0 : (i + 1)].kind;
    bus.registerEvent({
      type: 'source.event',
      kind: nextKind,
      validate: validateEventFactory({
        _extends: BaseEvent,
        val: {time: 10, type: 'int'},
      }),
    });

    bus[kind]({time: 10, type: 'source.event', val: 12});
    t.is(testConsole.getLogAndClear(),
      `warn: Event of kind '${nextKind}' reported thru '${kind}': {time: 10, type: 'source.event', val: 12}` +
      (!consoleMethod ? '' : ` | ${consoleMethod}: {time: 10, type: 'source.event', val: 12}`));

  });
});

test(`через on подписываемся на необъявленный тип сообщений`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole, testMode: true});
  const bus = new Bus();

  bus.registerEvent({
    type: 'source.event',
    kind: 'event',
    validate: validateEventFactory({
      _extends: BaseEvent,
      val: {time: 10, type: 'int'},
    }),
  });

  bus.on('source.event', () => {});
  t.is(testConsole.getLogAndClear(), '');

  bus.on('invalid.event', () => {});
  t.is(testConsole.getLogAndClear(), `warn: event of type 'invalid.event' is not registered`);
});

test(`если одно и то же сообщение ргистрируется несколько раз, ошибки не возникает`, t => {
  const testConsole = new TestConsole();
  const Bus = require('./bus').default({console: testConsole});
  const bus = new Bus();

  const ev1 = {
    type: 'source.event',
    kind: 'event',
    validate: validateEventFactory({
      _extends: BaseEvent,
      val: {time: 10, type: 'int'},
    }),
  };

  const ev2 = {
    type: 'source.event', // тип такой же как ev1
    kind: 'event',
    validate: validateEventFactory({
      _extends: BaseEvent,
      val: {time: 10, type: 'int'},
    }),
  };

  bus.registerEvent(ev1);
  bus.registerEvent(ev1); // объект описывающий событие тот же, ошибки нет
  t.throws(() => bus.registerEvent(ev2), `Duplicated event defintion: 'source.event'`);

});
