import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`2.1 createUpdateDeleteResoreDoc`, async t => {

  const {testDocsSvc, postgres} = t.context.manager.services;

  const result = new Result();

  let res = await testDocsSvc.invoke({
    context: `context`, result, http: true, type: 'doc.Doc1', update: {
      f1: 'test',
      password: "123456",
    }
  });

  t.deepEqual(result.messages, []);

  t.is(res.doc.hasOwnProperty('password'), false);

  const doc = res.doc;

  const pass1 = (await testDocsSvc.get({context: `context`, result, type: 'doc.Doc1', docId: doc.id})).password;

  await testDocsSvc.invoke({
    context: `context`, result, http: true, type: 'doc.Doc1', update: {
      id: doc.id,
      f2: 21,
      deleted: true,
      password: '', // do not change password
    }
  });

  t.deepEqual(result.messages, []);

  t.is((await testDocsSvc.get({context: `context`, result, type: 'doc.Doc1', docId: doc.id})).password, pass1);

  await testDocsSvc.invoke({
    context: `context`, result, http: true, type: 'doc.Doc1', update: {
      id: doc.id,
      f2: 21,
      deleted: false,
    }
  });

  t.deepEqual(result.messages, []);

  await testDocsSvc.invoke({
    context: `context`, result, http: true, type: 'doc.Doc1', update: {
      id: doc.id,
      rev: 0,
      f2: 21,
    }
  });

  t.deepEqual(result.messages, [
    {code: 'doc.updateFailedToWrite', type: 'error', docId: '', docType: 'doc.Doc1'},
    {type: 'error', docId: '', code: 'doc.oldRev', rev: 0},
  ]);
});

test.serial(`2.2 staticAction`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let res = await testDocsSvc.invoke({
    context: `context`, result, http: true, type: 'doc.Doc1', action: 'login', actionArgs: {
      email: "test@test.com",
      password: '321',
    }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res.result, {token: '321'});
});

// TODO: Errors
// TODO: w/o result
// TODO: extra fields
// TODO: user has no right
