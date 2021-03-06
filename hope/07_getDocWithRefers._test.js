import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

test.serial(`7.1 getDocWithRefers`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const result = new Result();

  let resA = await testDocsSvc.invoke({
    context: `context`, result,
    type: 'doc.DictA',
    update: {
      label: 'test label A',
      other: 999,
    }
  });

  t.deepEqual(result.messages, []);

  let resB = await testDocsSvc.invoke({
    context: `context`, result,
    type: 'doc.DictB',
    update: {
      label: 'test label B',
      other: 999,
    }
  });

  t.deepEqual(result.messages, []);

  let res = await testDocsSvc.invoke({
    context: `context`, result,
    type: 'doc.Doc3Refers',
    update: {
      title: 'test title',
      doc: resA.doc.id,
      struct: {
        n: 123,
        v: resA.doc.id
      },
      subtable: [
        {x: 9, y: resB.doc.id},
        {x: 8, y: resB.doc.id},
      ],
    }
  });

  t.deepEqual(result.messages, []);

  let {id, rev, created, modified, deleted, ...doc} = res;

  t.deepEqual(res.doc, {
    id: res.doc.id,
    rev: 0,
    title: 'test title',
    doc: {
      id: resA.doc.id,
      label: 'test label A',
      _type: 'doc.DictA',
    },
    struct: {
      n: 123,
      v: {
        id: resA.doc.id,
        label: 'test label A',
        _type: 'doc.DictA',
      },
    },
    subtable: [
      {
        x: 9, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
      {
        x: 8, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
    ],
    created: '',
    modified: '',
    deleted: false,
    _type: 'doc.Doc3Refers',
  });

  let resGet = await testDocsSvc.get({
    context: `context`, result,
    type: 'doc.Doc3Refers',
    docId: res.doc.id,
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(resGet, {
    id: res.doc.id,
    rev: 0,
    title: 'test title',
    doc: {
      id: resA.doc.id,
      label: 'test label A',
      _type: 'doc.DictA',
    },
    struct: {
      n: 123,
      v: {
        id: resA.doc.id,
        label: 'test label A',
        _type: 'doc.DictA',
      },
    },
    subtable: [
      {
        x: 9, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
      {
        x: 8, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
    ],
    created: '',
    modified: '',
    deleted: false,
    _type: 'doc.Doc3Refers',
  });

  let resList = await testDocsSvc.list({
    context: `context`,
    result,
    type: 'doc.Doc3Refers',
    filter: {
      id: res.doc.id,
    },
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(resList[0], {
    id: '',
    rev: 0,
    title: 'test title',
    doc: {
      id: resA.doc.id,
      label: 'test label A',
      _type: 'doc.DictA',
    },
    struct: {
      n: 123,
      v: {
        id: resA.doc.id,
        label: 'test label A',
        _type: 'doc.DictA',
      },
    },
    subtable: [
      {
        x: 9, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
      {
        x: 8, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
    ],
    created: '',
    modified: '',
    deleted: false,
    _type: 'doc.Doc3Refers',
  });

  let resListPaging = await testDocsSvc.list({
    context: `context`, result,
    type: 'doc.Doc3Refers',
    pageNo: 1,
    filter: {
      id: res.doc.id,
    },
  });

  t.deepEqual(result.messages, []);

  t.deepEqual(resListPaging.docs[0], {
    id: '',
    rev: 0,
    title: 'test title',
    doc: {
      id: resA.doc.id,
      label: 'test label A',
      _type: 'doc.DictA',
    },
    struct: {
      n: 123,
      v: {
        id: resA.doc.id,
        label: 'test label A',
        _type: 'doc.DictA',
      },
    },
    subtable: [
      {
        x: 9, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
      {
        x: 8, y: {
          id: resB.doc.id,
          label: 'test label B',
          _type: 'doc.DictB',
        }
      },
    ],
    created: '',
    modified: '',
    deleted: false,
    _type: 'doc.Doc3Refers',
  });
});

test.serial(`7.2 fixRefers`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const docDesc = testDocsSvc._model().docs['doc.Doc3Refers'];

  t.deepEqual(
    docDesc.fields.$$fix({
      doc: '123'
    }), {
      created: null,
      deleted: false,
      doc: '123',
      id: null,
      modified: null,
      options: null,
      rev: 0,
      struct: {
        n: 0,
        v: null,
      },
      subtable: [],
      title: '',
    });

  t.deepEqual(
    docDesc.fields.$$fix({
      doc: {
        id: '123',
      }
    }), {
      created: null,
      deleted: false,
      doc: '123',
      id: null,
      modified: null,
      options: null,
      rev: 0,
      struct: {
        n: 0,
        v: null,
      },
      subtable: [],
      title: '',
    });

  t.deepEqual(
    docDesc.fields.$$fix({
      doc: {
        id: '123',
      },
    }, {keepRefers: true}), {
      created: null,
      deleted: false,
      doc: {
        id: '123',
      },
      id: null,
      modified: null,
      options: null,
      rev: 0,
      struct: {
        n: 0,
        v: null,
      },
      subtable: [],
      title: '',
    });
});
