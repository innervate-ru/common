import md5 from 'md5'
import oncePerServices from "../services/oncePerServices";
import Result from "../../../../lib/hope/lib/result/index";
import build from "./_buildDoc";
import requestByContext from "../context/requestByContext";

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;
  const testMode = __testMode && __testMode.docs;


  return async function get(args) {
    schema.get_args(args);
    const {context, id, http} = args;

    const user = requestByContext(context)?.user;
    // TODO: Check can user retrieve this object

    let type = args.type;

    const newResult = !args.result;
    const result = args.result || new Result();

    const connection = args.connection || this._postgres;

    if (!type) {
      const statement = `select * from id_doctype where id = $1;`;
      const r = await connection.exec({
        context,
        name: md5(statement),
        statement,
        params: [id],
      });
      if (r.rowCount === 0) {
        result.error(`doc.notFound`, {id});
        if (newResult) result.throwIfError(); else return;
      }
      type = r.rows[0].type;
    }

    const docDesc = this._model.docs[type];
    if (!docDesc) {
      result.error(`doc.unknownType`, {docType: type});
      if (newResult) result.throwIfError(); else return;
    }

    const statement = `select * from ${docDesc.$$table} where id = $1;`;
    const r = await connection.exec({
      context,
      name: md5(statement),
      statement,
      params: [id],
    });

    if (r.rowCount === 0) {
      result.error(`doc.notFound`, {docType: type, id: testMode ? '' : id});
      if (newResult) result.throwIfError(); else return;
    }

    let doc = build(docDesc, r.rows[0]);

    // const access = docDesc.$$access(newDoc); // TODO: $$fix doc and $$get only fields viewable for given user

    if (http) {
      if (!this.applyUserRights({context, result, doc})) {
        result.error(`doc.noAccess`, {docType: type, id: testMode ? '' : id});
        if (newResult) result.throwIfError(); else return;
      }
    }

    return doc;
  }
});
