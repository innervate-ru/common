import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.skip(`1.1 insertUpdateRead: insert`, async t => {

  const {postgres, testDocsSvc} = t.context.manager.services;
  const insertRow = require('./_insertRow').default(t.context.manager.services);
  const updateRow = require('./_updateRow').default(t.context.manager.services);
  const build = require('./_buildDoc').default(t.context.manager.services);

  const result = new Result();

  const docDesc = testDocsSvc._model().docs['doc.Doc1'];

  let res = await insertRow('context', result, postgres, docDesc, {
    f1: '123',
    f2: 12,
  }, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  let doc = await build('context', result, docDesc, res, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  docDesc.$$validate(result, doc, {strict: false});

  t.deepEqual(result.messages, []);

  res = await updateRow('context', result, postgres, docDesc, {
    id: doc.id,
    f2: 21,
    deleted: true
  }, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  t.deepEqual(result.messages, []);

  doc = await build('context', result, docDesc, res, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  docDesc.$$validate(result, doc, {strict: false});

  t.deepEqual(result.messages, []);

  res = await updateRow('context', result, postgres, docDesc, {
    id: doc.id,
    rev: 1,
    f2: 121,
    deleted: true
  }, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  t.deepEqual(result.messages, []);

  res = await updateRow('context', result, postgres, docDesc, {
    id: doc.id,
    rev: 1,
    f2: 121,
    deleted: true
  }, docDesc.fields.$$calc('#all'), docDesc.fields.$$calc('#all'));

  t.deepEqual(result.messages, [
    {type: 'error', docId: '', code: 'doc.oldRev', rev: 1},
  ]);
});
