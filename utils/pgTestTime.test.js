import test from 'ava'
import sinon from 'sinon'

import pgTestTime from './pgTestTime'

// ВНИМАНИЕ: Налетел на проблему, что тесты валятся когда работают вместе и используют sinon.useFakeTimers().  Поэтому тесты надо запускать в режиме serial.
test.beforeEach(t => {
  t.context.clock = sinon.useFakeTimers();
});
test.afterEach(t => {
  t.context.clock.restore();
});

test.serial(`в production режиме параметры не изменяются`, t => {
  const testTime = pgTestTime(undefined);
  const args = {
    statement: 'select * from type = $1 and lock < now() and process next_time < now()',
    params: ['test'],
  };
  t.is(testTime(args), args);
});

test.serial(`в тестовом режиме добавляется параметр, через который передается Date.now()`, t => {
  const testTime = pgTestTime(true);
  const args = {
    statement: 'select * from type = $1 and lock < now() and process next_time < now()',
    params: ['test'],
    context: '123',
  };
  t.deepEqual(testTime(args), {
    statement: 'select * from type = $1 and lock < $2 and process next_time < $2',
    params: ['test', Date.now()],
    context: '123',
  });
});

test.serial(`в тестовом режиме, если нет params`, t => {
  const testTime = pgTestTime(true);
  const args = {
    statement: 'select * from lock < now()',
    context: '123',
  };
  t.deepEqual(testTime(args), {
    statement: 'select * from lock < $1',
    params: [Date.now()],
    context: '123',
  });
});
