import test from 'ava'

import bindErrorToContext from './bindErrorToContext'

test(`добавление контекста в простую ошибку`, t => {
  const context = 'contextA';
  try {
    throw new Error('Some error');
  } catch (error) {
    bindErrorToContext(error, context);
    t.deepEqual(error.context, {id: context});
  }
});

test(`добавление контекста в ошибку полученную из сервиса, который получил как параметр текущий контекст`, t => {
  const context = 'contextA';
  try {
    const error = new Error('Some error');
    error.context = {id: context, stack: [{service: 'svc2', method: 'amethod'}]};
    throw error;
  } catch (error) {
    bindErrorToContext(error, context);
    t.deepEqual(error.context, {id: context, stack: [{service: 'svc2', method: 'amethod'}]});
  }
});

test(`добавление контекста в ошибку полученную из сервиса, которому забыли передать контекст`, t => {
  const context = 'contextA';
  try {
    const error = new Error('Some error');
    error.context = {id: 'contextB', stack: [{service: 'svc2', method: 'amethod'}]}; // contextB означает что при вызове метода не был передан contextA
    throw error;
  } catch (error) {
    bindErrorToContext(error, context);
    t.deepEqual(error.context, {id: context, stack: [ // контекст заменен на правильный, и добавлено сообщение о проблеме в stack
      {service: 'svc2', method: 'amethod'},
      `Context being replaced to 'contextB'`,
    ]});
  }
});
