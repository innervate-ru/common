import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`3.1 actionsOnDoc`, async t => {

  const {testDocsSvc: hope} = t.context.manager.services;

  const result = new Result();

  let {doc} = await hope.invoke({context: `context`, result, type: 'doc.Doc1', update: {
      f1: 'test',
      str: {
        d: '4567'
      },
      password: '123456',
    }});

  t.deepEqual(result.messages, []);

  let res = await hope.invoke({context: `context`, result, type: 'doc.Doc1', docId: doc.id, action: 'submit', actionArgs: {
      x: 12,
      y: null,
      z: [
        {a: 12, b: '1'},
        {a: 24, b: '2'},
        {a: 36, b: '2'},
      ],
    }});

  t.deepEqual(result.messages, []);

  ({doc} = res);

  t.is(doc.state, 'submit');
});

test.serial(`3.2 actionsWithError`, async t => {

  const {testDocsSvc: hope} = t.context.manager.services;

  const result = new Result();

  const {doc} = await hope.invoke({context: `context`, result, http: true, type: 'doc.Doc1',
    update: {
      f1: 'test',
      str: {
        d: '4567'
      },
    },});

  await hope.invoke({context: `context`, result, http: true, type: 'doc.Doc1',
    update: {
      id: doc.id,
      f1: 'test2',
      str: {
        d: '45678'
      },
    },
    action: 'errorAction',});

  t.deepEqual(result.messages, [
    {
      action: 'errorAction',
      code: 'doc.failedActionCode',
      docType: 'doc.Doc1',
      type: 'error',
    },
    {
      code: 'someError',
      type: 'error',
    },]);
  result.reset();

  // так как во время invoke произошла ошибка, то update тоже откатывается

  // TODO: Вернуть вместе с кодом scope

  // const doc2 = await hope.get({context: 'context', result, http: true, type: 'doc.Doc1', docId: doc.id});
  //
  // t.deepEqual(result.messages, []);
  //
  // t.deepEqual(doc2, doc);
});
