import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

// TODO: Сделать проверку при обновлении что тип документа, на который ссылка, соотвествует схеме.  Только когда значение поля меняется
// TODO: Сделать загрузку документов по ссылке
// TODO: В $$fix поля реферс заменять на их id
// TODO: Проверить что id всегда возвращается в документе
// TODO: Сделать специальный режим $$fix чтоб refers не заменялись на id.  Использовать его в get, list, invoke
// TODO: Сделать что когда маска none - invoke не возвращает doc

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

  // res = await testDocsSvc.get({context: `context`, result, type: 'doc.Doc3Refers', docId: res.doc.id});

  // t.deepEqual(result.messages, []);

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

  // TODO: Check list

});
