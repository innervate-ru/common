import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`4.1 getDoc`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let doc = await testDocsSvc.update({context: `context`, result, type: 'doc.Doc1', doc: {
      f1: 'test',
      f2: 121,
    }});

  t.deepEqual(result.messages, []);

  let res = await testDocsSvc.get({context: `context`, result, type: 'doc.Doc1', id: doc.id});

  t.deepEqual(result.messages, []);

  t.is(res.f1, 'test');
  t.is(res.f2, 121);

  res = await testDocsSvc.get({context: `context`, result, id: doc.id}); // w/o type

  t.deepEqual(result.messages, []);

  t.is(res.f1, 'test');
  t.is(res.f2, 121);
});
