import test from 'ava'

import addContextToError from './addContextToError'

test(`ошибка случилась в корне (сервисе, http-запросе ...) контекста, без вложенных уровней`, t => {
  const args = null;
  const newArgs = {context: 'acontext'}; // это контекст, который добавил метод ./addContextToArgs
  const error = {};
  const details = {method: 'amethod'};
  t.true(addContextToError(args, newArgs, error, details)); // true, это корень контекста
  t.deepEqual(error, {context: {id: 'acontext', stack: [details]}});
});

test(`ошибка не в корне контекста`, t => {
  const args = null;
  const newArgs = {context: 'acontext', a: 12};
  const error = {};
  const details = {method: 'amethod'};
  t.false(addContextToError(newArgs, newArgs, error, details)); // false, это не корень контекста
  t.deepEqual(error, {context: {id: 'acontext', stack: [{method: 'amethod', args: {a: 12}}]}}); // в детали добавлен args со значением из параметра newArgs, но без поля context
});

test(`ошибка в корне контекста, с вложенными уровнями, добавляющими контекст в ошибку`, t => {
  const args = null;
  const newArgs = {context: 'acontext'};
  const details1 = {method: 'amethodB'}; // детали вложенного сервиса
  const error = {context: {id: 'acontext', stack: [details1]}};
  const details2 = {method: 'amethodA'};
  t.false(addContextToError(newArgs, newArgs, error, details2)); // false, это не корень контекста
  t.deepEqual(error, {context: {id: 'acontext', stack: [details1, {method: 'amethodA', args: {}}]}}); // добавился второй элемент в constext.stack, и в него добавлено значение newArgs без поля context
});
