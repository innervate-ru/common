import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`3.1 actionsOnDoc`, async t => {

  const {'docs/baseDocs/testDocsSvc': testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let doc = await testDocsSvc.update({context: `context`, result, type: 'doc.Doc1', doc: {
      f1: 'test',
      str: {
        d: '4567'
      },
    }});

  t.deepEqual(result.messages, []);

  let res = await testDocsSvc.update({context: `context`, result, type: 'doc.Doc1', doc: doc.id, action: 'submit', actionArgs: {
      x: 12,
      y: null,
      z: [
        {a: 12, b: '1'},
        {a: 24, b: '2'},
        {a: 36, b: '2'},
      ]
    }});

  t.deepEqual(result.messages, []);

  t.is(res.state, 'submit');
});
