import md5 from 'md5'
import oncePerServices from "../services/oncePerServices";
import Result from "../../../../lib/hope/lib/result/index";

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;
  const testMode = __testMode && __testMode.hope;

  // const build = require('./_buildDoc').default(services);

  return async function applyUserRights(args) {
/*
    schema.applyUserRights_args(args);
    const {context, doc} = args;

    const newResult = !args.result;
    const result = args.result || new Result();

    // const connection = args.connection || this._postgres;

    const docDesc = this._model().docs[doc._type];
    if (!docDesc) {
      result.error(`doc.unknownType`, {docType: type});
      if (newResult) result.throwIfError(); else return;
    }

    const res = docDesc.actions.retrieve.$$code?.({context, result, doc, docDesc, model: this._model()});

    if (result.isError) {
      if (newResult) result.throwIfError(); else return;
    }

    return res; // may be undefined
*/

    return true;
  }
});
