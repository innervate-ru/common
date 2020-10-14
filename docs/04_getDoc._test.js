import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`4.1 getDoc`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let res = await testDocsSvc.invoke({context: `context`, result, type: 'doc.Doc1', update: {
      f1: 'test',
      f2: 121,
      password: '123456',
      file: {name: 'abc'}
    }});

  t.deepEqual(result.messages, []);

  const {doc} = res;

  res = await testDocsSvc.get({context: `context`, result, type: 'doc.Doc1', id: doc.id});

  t.deepEqual(result.messages, []);

  t.is(res.f1, 'test');
  t.is(res.f2, 121);

  res = await testDocsSvc.get({context: `context`, result, id: doc.id}); // w/o type

  t.deepEqual(result.messages, []);

  t.is(res.f1, 'test');
  t.is(res.f2, 121);

  // with http: true
  res = await testDocsSvc.get({context: `context`, result, id: doc.id, http: true}); // w/o type

  t.deepEqual(result.messages, []);

  t.is(res.f1, 'test');
  t.is(res.f2, 121);
});
