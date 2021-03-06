import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`6.1 getDocWithComputed`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let res = await testDocsSvc.invoke({
    context: `context`, result, type: 'doc.Doc2Computed', update: {
      f1: 1,
      f2: 2,
      struct: {
        n: 123
      },
      subtable: [
        {x: 9},
        {x: 8},
      ],
    }
  });

  t.deepEqual(result.messages, []);

  res = await testDocsSvc.get({context: `context`, result, type: 'doc.Doc2Computed', docId: res.doc.id});

  t.deepEqual(result.messages, []);

  let {id, rev, created, modified, deleted, ...doc} = res;

  t.deepEqual(doc, {
    title: 'some title',
    f1: 1,
    f2: 2,
    sum: 3,
    struct: {
      n: 123,
      v: 123,
    },
    subtable: [
      {x: 9, y: 9},
      {x: 8, y: 8},
    ],
    _type: 'doc.Doc2Computed',
  });

  // TODO: Check list

});

test.serial(`6.2 getDocWithComputedWrong`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let res = await testDocsSvc.invoke({
    context: `context`, result,
    type: 'doc.Doc2ComputedWrong',
    update: {
      f1: 1,
      f2: 2,
      struct: {
        n: 123
      },
      subtable: [
        {x: 9},
        {x: 8},
      ],
    }
  });

  t.deepEqual(result.messages, [
    {
      code: 'doc.createFailedToWrite',
      docId: '',
      docType: 'doc.Doc2ComputedWrong',
      type: 'error',
    },
    {
      code: 'validate.invalidValue',
      path: 'title',
      type: 'error',
      value: false,
    },
    {
      code: 'validate.invalidValue',
      path: 'sum',
      type: 'error',
      value: 'string',
    },
    {
      code: 'validate.invalidValue',
      path: 'struct.v',
      type: 'error',
      value: [],
    },
    {
      code: 'validate.invalidValue',
      path: 'subtable[0].y',
      type: 'error',
      value: {},
    },
    {
      code: 'validate.invalidValue',
      path: 'subtable[1].y',
      type: 'error',
      value: {},
    },
  ]);
});
