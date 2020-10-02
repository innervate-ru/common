import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

import build from './_buildDoc'

test.serial(`1.1 insertUpdateRead: insert`, async t => {

  const {postgres, 'docs/baseDocs/testDocsSvc': testDocsSvc} = t.context.manager.services;
  const insertRow = require('./_insertRow').default(t.context.manager.services);
  const updateRow = require('./_updateRow').default(t.context.manager.services);

  const result = new Result();

  const docDesc = testDocsSvc._model.docs['doc.Doc1'];

  let res = await insertRow('context', postgres, docDesc, {
    f1: '123',
    f2: 12,
  });

  let doc = build(docDesc, res);

  docDesc.$$validate(result, doc, {strict: false});

  t.deepEqual(result.messages, []);

  res = await updateRow(result, 'context', postgres, docDesc, {
    id: doc.id,
    f2: 21,
    deleted: true
  });

  t.deepEqual(result.messages, []);

  doc = build(docDesc, res);

  docDesc.$$validate(result, doc, {strict: false});

  t.deepEqual(result.messages, []);

  res = await updateRow(result, 'context', postgres, docDesc, {
    id: doc.id,
    rev: 1,
    f2: 121,
    deleted: true
  });

  t.deepEqual(result.messages, []);

  res = await updateRow(result, 'context', postgres, docDesc, {
    id: doc.id,
    rev: 1,
    f2: 121,
    deleted: true
  });

  t.deepEqual(result.messages, [
    {type: 'error', doc: '', code: 'doc.oldRev', rev: 1},
  ]);
});
