import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`2.1 createUpdateDeleteResoreDoc`, async t => {

  const {'docs/baseDocs/testDocsSvc': testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let doc = await testDocsSvc.update({
    context: `context`, result, type: 'doc.Doc1', doc: {
      f1: 'test',
    }
  });

  t.deepEqual(result.messages, []);

  doc = await testDocsSvc.update({
    context: `context`, result, type: 'doc.Doc1', doc: {
      id: doc.id,
      f2: 21,
      deleted: true,
    }
  });

  t.deepEqual(result.messages, []);

  doc = await testDocsSvc.update({
    context: `context`, result, type: 'doc.Doc1', doc: {
      id: doc.id,
      f2: 21,
      deleted: false,
    }
  });

  t.deepEqual(result.messages, []);

  doc = await testDocsSvc.update({
    context: `context`, result, type: 'doc.Doc1', doc: {
      id: doc.id,
      rev: 0,
      f2: 21,
    }
  });

  t.deepEqual(result.messages, [
    {code: 'doc.updateFailedToWrite',type: 'error'},
    {type: 'error', doc: '', code: 'doc.oldRev', rev: 0},
  ]);
});

// TODO: Errors
// TODO: w/o result
// TODO: extra fields
// TODO: user has no right
