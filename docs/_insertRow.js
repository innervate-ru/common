import nanoid from 'nanoid'
import md5 from 'md5'
import buildDoc from './_buildDoc'

import oncePerServices from '../services/oncePerServices'

export default oncePerServices(function (services) {

  const {
    _testMode
  } = services;

  const testMode = _testMode && _testMode.docs;

  return async function insert(context, connection, docDesc, doc) {

    const params = [nanoid(), docDesc.name];
    const fields = [docDesc.fields.id.$$field];
    const values = ['$1'];
    const indices = [docDesc.fields.id.$$index];

    docDesc.fields.$$tags.field.list.forEach(fieldDesc => {
      switch (fieldDesc.name) {
        case 'id':
        case 'rev':
        case 'created':
        case 'modified':
        case 'deleted':
          return;
        case 'options':
          params.push(docDesc.fields.$$get(doc, docDesc.fields.$$tags.field.invert(), {newVal: false}));
          break;
        default:
          if (!doc.hasOwnProperty(fieldDesc.name)) return;
          params.push(doc[fieldDesc.name]);
      }
      fields.push(fieldDesc.$$field);
      indices.push(fieldDesc.$$index);
      values.push(`$${params.length}`);
    });

    const statement = `
with t as (insert into id_doctype values ($1, $2))
insert into ${docDesc.$$table} (${fields.join(',')}) values (${values.join(',')}) returning *;`
    const r = await connection.exec({
      context,
      name: md5(statement),
      statement,
      params,
    });

    return buildDoc(docDesc, r.rows[0]);
  };
});
