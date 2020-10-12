import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`3.1 actionsOnDoc`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let {doc} = await testDocsSvc.invoke({context: `context`, result, type: 'doc.Doc1', update: {
      f1: 'test',
      str: {
        d: '4567'
      },
    }});

  t.deepEqual(result.messages, []);

  ({doc} = await testDocsSvc.invoke({context: `context`, result, type: 'doc.Doc1', docId: doc.id, action: 'submit', actionArgs: {
      x: 12,
      y: null,
      z: [
        {a: 12, b: '1'},
        {a: 24, b: '2'},
        {a: 36, b: '2'},
      ]
    }}));

  t.deepEqual(result.messages, []);

  t.is(doc.state, 'submit');
});
