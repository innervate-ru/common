import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`5.1 listDocs`, async t => {

  const {testDocsSvc, postgres} = t.context.manager.services;

  const result = new Result();

  await postgres.exec({
    statement: `delete from doc_doc_1`,
  });

  let res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 2,
    pageSize: 4,
    pageExtra: 2,
    order: {
      f2: true,
      }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res, {
    pageNo: 1,
    pageExtra: 0,
    last: true,
    count: 0,
    docs: []
  });

  for (let i = 0; i < 15; i++) {
    await testDocsSvc.update({
      context: `context`, result, type: 'doc.Doc1', doc: {
        f1: 'test',
        f2: i,
      }
    });
    t.deepEqual(result.messages, []);
  }

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 2,
    pageSize: 4,
    pageExtra: 2,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res, {
    pageNo: 2,
    pageExtra: 2,
    last: false,
    docs: [
      {id: '', rev: 0, f1: 'test', f2: 4, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 5, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 6, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 7, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
    ]
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 1000,
    pageSize: 4,
    pageExtra: 2,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res, {
    pageNo: 4,
    pageExtra: 0,
    last: true,
    count: 15,
    docs: [
      {id: '', rev: 0, f1: 'test', f2: 12, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 13, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 14, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
    ]
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    last: true,
    pageNo: 1,
    pageSize: 10,
    pageExtra: 2,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res, {
    pageNo: 2,
    pageExtra: 0,
    last: true,
    count: 15,
    docs: [
      {id: '', rev: 0, f1: 'test', f2: 10, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 11, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 12, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 13, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 14, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
    ]
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 1,
    pageSize: 2,
    pageExtra: 10,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(res, {
    pageNo: 1,
    pageExtra: 7,
    last: false,
    docs: [
      {id: '', rev: 0, f1: 'test', f2: 0, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
      {id: '', rev: 0, f1: 'test', f2: 1, st: [], str: {c: 0, d: ''}, state: 'new', created: '', modified: '', deleted: false, _type: 'doc.Doc1'},
    ],
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 5,
    pageSize: 3,
    pageExtra: 10,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  delete res.docs;

  t.deepEqual(res, {
    pageNo: 5,
    pageExtra: 0,
    last: true,
    count: 15,
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 4,
    pageSize: 4,
    pageExtra: 0,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  delete res.docs;

  t.deepEqual(res, {
    pageNo: 4,
    pageExtra: 0,
    last: true,
    count: 15,
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    pageNo: 2,
    pageSize: 7,
    pageExtra: 0,
    order: {
      f2: true,
    }
  });

  t.deepEqual(result.messages, []);

  delete res.docs;

  t.deepEqual(res, {
    pageNo: 2,
    pageExtra: 1,
    last: false,
  });

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
  });

  t.deepEqual(result.messages, []);

  t.is(res.length, 15);

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    offset: 10,
  });

  t.deepEqual(result.messages, []);

  t.is(res.length, 5);

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    limit: 10,
  });

  t.deepEqual(result.messages, []);

  t.is(res.length, 10);

  res = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc1',
    offset: 5,
    limit: 5,
  });

  t.deepEqual(result.messages, []);

  t.is(res.length, 5);
});
