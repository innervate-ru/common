import test from 'ava'

import addContextToError from '../context/addContextToError'

import errorDataToEvent from './errorDataToEvent'

test(`просто ошибка`, t => {
  const error = new Error('test');
  error.stack = ``;
  const event = Object.create(null);
  t.is(errorDataToEvent(error, event), undefined); // ничего не возвращает
  t.deepEqual(event, {
    message: `Error: test`,
    stack: `Error: test\n    `,
  });
});

test(`ошибка с context`, t => {
  const error = new Error('test');
  const args = {context: 'acontext'};
  addContextToError(args, args, error, {method: 'amethod'}); // добавляем контекст
  error.stack = ``;
  const event = Object.create(null);
  t.is(errorDataToEvent(error, event), undefined); // ничего не возвращает
  t.deepEqual(event, {
    message: `Error (acontext): test`,
    stack: `Error (acontext): test\n    `,
    context: {
      id: 'acontext',
      stack: [
        {method: 'amethod', args: {}},
      ]
    }
  });
});

