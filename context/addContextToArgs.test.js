import test from 'ava'
import prettyPrint from '../utils/prettyPrint'

import addContextToArgs from './addContextToArgs'

test(`добавляет контекст, если его нет`, t => {
  const args1 = Object.create(null);
  args1.a = 12;
  const newArgs1 = addContextToArgs(args1);
  t.not(newArgs1, args1);
  t.deepEqual(newArgs1, {a: 12, context: newArgs1.context});

  const args2 = {b: 21};
  const newArgs2 = addContextToArgs(args2);
  t.not(newArgs2, args2);
  t.deepEqual(newArgs2, {b: 21, context: newArgs2.context});
});

test(`не изменяет конекст, если он уже есть`, t => {
  const args1 = Object.create(null);
  args1.a = 12;
  args1.context = 'acontext';
  t.is(addContextToArgs(args1), args1);

  const args2 = {b: 21, context: 'acontext'};
  t.is(addContextToArgs(args2), args2);
});

test(`если нет аргументов, то будет создан новый объект с context`, t => {
  const newArgs = addContextToArgs(undefined);
  t.deepEqual(newArgs, {context: newArgs.context});

  const newArgs2 = addContextToArgs(null);
  t.deepEqual(newArgs2, {context: newArgs2.context});
});

for (const wrongValue of [0, 'wrong', [], false])
  test(`ошибка если args не объект или undefined или null`, t => {
    t.throws(() => addContextToArgs(wrongValue), `Invalid argument \'args\': ${prettyPrint(wrongValue)}`);
  });

