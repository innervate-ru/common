import test from 'ava'

test.only(`20.1 userRights`, async t => {

  const {testDocsSvc} = t.context.manager.services;

  const model = testDocsSvc._model();

  const r = model.docs['doc.Doc4Rights'].$$access(null, null);
  console.info(10, r.view.list.map(v => v.fullname || v.name).join(', '));
  console.info(11, r.update.list.map(v => v.fullname || v.name).join(', '));
  console.info(12, r.required.list.map(v => v.fullname || v.name).join(', '));
  console.info(13, r.actions.list.map(v => v.name).join(', '));



});
