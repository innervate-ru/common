import md5 from 'md5'
import buildDoc from "./_buildDoc";

import oncePerServices from '../services/oncePerServices'

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;

  const testMode = __testMode && __testMode.docs;

  return async function update(result, context, connection, docDesc, doc) {

    const params = [doc.id];
    const fields = [];
    const indices = [];

    const hasRev = doc.hasOwnProperty('rev');
    if (hasRev) params.push(doc.rev);

    docDesc.fields.$$tags.field.list.forEach(fieldDesc => {
      switch (fieldDesc.name) {
        case 'id':
        case 'rev':
        case 'created':
        case 'modified':
          return;
        case 'options':
          params.push(docDesc.fields.$$get(doc, docDesc.fields.$$tags.field.invert(), {newVal: false}));
          break;
        default:
          if (!doc.hasOwnProperty(fieldDesc.name)) return;
          params.push(doc[fieldDesc.name]);
      }
      fields.push(`${fieldDesc.$$field}=$${params.length}`);
      indices.push(fieldDesc.$$index);
    });

    const statement = `update ${docDesc.$$table} set rev=rev+1,${fields.join(',')} where id=$1${hasRev ? ` and rev=$2` : ``} returning *;`;
    const r = await connection.exec({
      context,
      name: md5(statement),
      statement,
      params,
    });

    if (r.rowCount === 0) {
      result.error('doc.oldRev', {doc: testMode ? '' : doc.id, rev: doc.rev});
      return;
    }

    return buildDoc(docDesc, r.rows[0]);
  };
});
