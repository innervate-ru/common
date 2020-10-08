import md5 from 'md5'
import oncePerServices from '../services/oncePerServices'
import Result from '../../../../lib/hope/lib/result/index'
import build from './_buildDoc'
import requestByContext from '../context/requestByContext'

const debug = require('debug')('docs.update');

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;
  const testMode = __testMode && __testMode.docs;

  const insertRow = require('./_insertRow').default(services);
  const updateRow = require('./_updateRow').default(services);

  return async function update(args) {
    schema.update_args(args);
    const {context, type, doc, action, actionArgs} = args;

    const user = requestByContext(context)?.user;

    const newResult = !args.result;
    const result = args.result || new Result();

    const localResult = new Result();

    const connection = args.connection || this._postgres;

    //
    // process type
    //

    const docDesc = this._model.docs[type];
    if (!docDesc) {
      result.error(`doc.unknownType`, {docType: type});
      if (newResult) result.throwIfError(); else return;
    }

    //
    // process update
    //

    // basic validate update

    let newDoc = doc;

    const runActionCode = async (actionDesc) => {
      let res;
      if (actionDesc.$$code) {
        try {
          res = actionDesc.$$code({
            context,
            result,
            doc: newDoc,
            docDesc,
            actionDesc,
            model: this._model,
          });
          if (typeof res === 'object' && res !== null && !Array.isArray(res) && typeof res.then === 'function') await res;
          return res;
        } catch (err) {
          err.context = context;
          this._service._reportError(err);
          result.error(`doc.systemError`, {context});
        }
      }
    };

    // get existing doc
    let existingDoc;
    if (typeof doc === 'string' || doc.hasOwnProperty('id')) {
      // TODO: Check docType level retrieve right
      const statement = `select * from ${docDesc.$$table} where id = $1;`;
      const r = await connection.exec({
        context,
        name: md5(statement),
        statement,
        params: [typeof doc === 'string' ? doc : doc.id],
      });
      if (r.rowCount === 0) {
        result.error('doc.notFound', {docType: type, doc: testMode ? '' : doc.id});
        if (newResult) result.throwIfError(); else return;
      }
      existingDoc = docDesc.fields.$$fix(build(docDesc, r.rows[0]), {mask: docDesc.fields.$$calc('#all-options')});
    } else {
      // TODO: Check docType level create right

      existingDoc = await runActionCode(docDesc.actions.create);
      if (result.isError) if (newResult) result.throwIfError(); else return;

      if (!existingDoc) existingDoc = docDesc.fields.$$new();
    }

    debug(`update: existingDoc: %o`, existingDoc);

    let access;
    if (typeof doc === 'object') {

      debug(`update: doc: %o`, doc);

      docDesc.$$validate(localResult, doc, {beforeAction: false, strict: true, mask: docDesc.fields.$$tags.all});
      if (localResult.isError) {
        result.error(`doc.wrongUpdateArgs`, {docType: type, doc: existingDoc.id, step: 1});
        result.add(localResult);
        if (newResult) result.throwIfError(); else return;
      }

      newDoc = existingDoc;
      // при изменении документа может меняться update маска, если есть поля, которые становятся редактируемыми при определенных
      // значенях других полей. поэтому поля обновляются в несколько попыток, с пересчетом прав после каждого обновления
      for (let i = 0; ; i++) {

        // get access mask
        const prevAccess = access;

        access = docDesc.$$access(newDoc, user);

        if (debug.enabled) {
          debug(`update: access.update[%d]: %o`, i, access.update.list.map(v => v.name));
        }

        if (prevAccess && prevAccess.update.equal(access.update)) break; // если маска update не изменилась, значит обновление полность применено

        if (i === 10) {
          result.error('doc.tooManyUpdateCycles', {docType: type, doc: existingDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        // apply update
        const state = newDoc.state;
        newDoc = docDesc.fields.$$set(newDoc, doc, {
          updateMask: docDesc.fields.$$calc('id,rev,deleted').or(access.update),
          newVal: false
        });
        if (state) newDoc.state = state;

        debug(`update: newDoc[%d]: %o`, i, newDoc);
      }

      docDesc.$$validate(localResult, doc, {
        access,
        beforeAction: false,
        strict: true,
        mask: access.update.add('id,rev,deleted'),
      });
      if (localResult.isError) {
        result.error(`doc.wrongUpdateArgs`, {docType: type, doc: existingDoc.id, step: 2});
        result.add(localResult);
        if (newResult) result.throwIfError(); else return;
      }

      // is this existing document?
      if (doc.hasOwnProperty('id')) {

        if (!access.actions.get(docDesc.actions.retrieve.$$index)) {
          result.error(`doc.notAvailable`, {docType: type, doc: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        await runActionCode(docDesc.actions.retrieve);
        if (result.isError) if (newResult) result.throwIfError(); else return;

        if (!access.actions.get(docDesc.actions.update.$$index)) {
          result.error(`doc.cannotUpdate`, {docType: type, doc: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        await runActionCode(docDesc.actions.update);
        if (result.isError) if (newResult) result.throwIfError(); else return;

        if (existingDoc.deleted) {
          if (!newDoc.deleted) {
            if (!access.actions.get(docDesc.actions.restore.$$index)) {
              result.error(`doc.cannotRestore`, {docType: type, doc: newDoc.id});
              if (newResult) result.throwIfError(); else return;
            }

            await runActionCode(docDesc.actions.restore);
            if (result.isError) if (newResult) result.throwIfError(); else return;
          }
        } else {

          if (newDoc.deleted) {
            if (!access.actions.get(docDesc.actions.delete.$$index)) {
              result.error(`doc.cannotDelete`, {docType: type, doc: newDoc.id});
              if (newResult) result.throwIfError(); else return;
            }

            await runActionCode(docDesc.actions.delete);
            if (result.isError) if (newResult) result.throwIfError(); else return;
          }
        }

        // TODO: build difference. if none do not update

        // update document
        newDoc = docDesc.fields.$$get(newDoc, docDesc.fields.$$calc('id,rev,deleted').or(access.view).or(access.update));
        newDoc = await updateRow(localResult, context, connection, docDesc, newDoc);
        if (localResult.isError) {
          result.error(`doc.updateFailedToWrite`, {docType: type, doc: testMode ? '' : existingDoc.id});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

      } else {

        if (!access.actions.get(docDesc.actions.create.$$index)) {
          result.error(`doc.cannotCreate`, {docType: type, doc: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        await runActionCode(docDesc.actions.update);
        if (result.isError) if (newResult) result.throwIfError(); else return;

        // create document
        newDoc = docDesc.fields.$$get(newDoc, access.view.or(access.update));

        newDoc = await insertRow(context, connection, docDesc, newDoc);
      }

      // TODO: Log history

    } else {
      newDoc = existingDoc;
    }

    //
    // process action
    //
    if (action) {

      debug(`action: %o`, action)

      const actionDesc = docDesc.actions[action];

      if (!actionDesc) {
        result.error('doc.unknownAction', {docType: type, doc: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      if (docDesc.actions.$$tags.system.get(actionDesc.$$index)) {
        result.error('doc.systemActionCannotBeCalledDirectly', {docType: type, doc: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      if (!access) {
        access = docDesc.$$access(newDoc)
      }

      if (!access.actions.get(actionDesc.$$index)) {
        result.error('doc.actionIsNotAvailable', {docType: type, doc: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      if (!actionDesc.skipValidation) {
        docDesc.$$validate(localResult, newDoc, {access, beforeAction: true, strict: false});
        if (localResult.isError) {
          result.error(`doc.invalidDocBeforeAction`, {docType: type, action});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      }

      let transitionDesc;
      if (docDesc.fields.state && !(transitionDesc = docDesc.states[newDoc.state]?.transitions[action])) {
        result.error('doc.actionNotAllowedInThisState', {
          docType: type,
          doc: testMode ? '' : newDoc.id,
          state: doc.state,
          action
        });
        if (newResult) result.throwIfError(); else return;
      }

      if (actionDesc.arguments) {
        if (!actionArgs) {
          result.error('doc.actionArgsRequired', {docType: type, doc: testMode ? '' : newDoc.id, action});
          if (newResult) result.throwIfError(); else return;
        }
        actionDesc.arguments.$$validate(localResult, actionArgs, {beforeAction: true});
        if (localResult.isError) {
          result.error(`doc.invalidActionArgs`, {docType: type, doc: testMode ? '' : newDoc.id, action: action});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      } else if (actionArgs) {
        result.error('doc.actionArgsNotExpected', {docType: type, doc: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      let actionUpdate;
      if (actionDesc.$$code) {

        let res;

        try {
          res = actionDesc.$$code({
            context,
            result,
            doc: newDoc,
            args: actionArgs,
            docDesc,
            actionDesc,
            model: this._model,
          });

          if (typeof res === 'object' && res !== null && !Array.isArray(res) && typeof res.then === 'function') res = await res;

        } catch (err) {
          err.context = context;
          this._service._reportError(err);
          result.error(`doc.systemError`, {context});
          if (newResult) result.throwIfError(); else return;
        }

        debug(`action: res: %o`, res);

        if (result.isError) if (newResult) result.throwIfError(); else return;

        if (typeof res === 'object' && res !== null && !Array.isArray(res)) {

          if (res.update) {

            actionUpdate = docDesc.fields.$$fix(res.update, {newVal: false});

            docDesc.$$validate(localResult, actionUpdate, {mask: docDesc.fields.$$tags.all});
            if (localResult.isError) {
              result.error(`doc.invalidUpdateFromActionCode`, {
                docType: type,
                doc: testMode ? '' : newDoc.id,
                action: action,
                step: 1,
              });
              result.add(localResult);
              if (newResult) result.throwIfError(); else return;
            }
          }
          if (res.state) {
            if (!docDesc.states[res.state]) {
              result.error('doc.actionCodeReturnedUnknownState', {
                docType: type,
                doc: testMode ? '' : newDoc.id,
                state: res.state,
                action,
              });
              if (newResult) result.throwIfError(); else return;
            }
            (actionUpdate || (actionUpdate = {})).state = res.state;
          }
        }
      }

      if (transitionDesc && !(actionUpdate && actionUpdate.state)) (actionUpdate || (actionUpdate = {})).state = transitionDesc.next.name;

      if (actionUpdate) {

        // apply update
        newDoc = docDesc.fields.$$set(newDoc, actionUpdate);

        access = docDesc.$$access(newDoc);

        docDesc.$$validate(localResult, actionUpdate, {mask: access.view.or(access.update)});
        if (localResult.isError) {
          result.error(`doc.invalidUpdateFromActionCode`, {
            docType: type,
            doc: testMode ? '' : newDoc.id,
            action: action,
            step: 2,
          });
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

        // update document
        newDoc = docDesc.fields.$$get(newDoc, access.view.add(access.update).add('id,rev,state,deleted'));
        newDoc = await updateRow(localResult, context, connection, docDesc, newDoc);
        if (localResult.isError) {
          result.error(`doc.failedToWriteActionUpdate`, {
            docType: type,
            doc: testMode ? '' : newDoc.id,
            action: action
          });
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      }

      // TODO: Log history
    }

    return newDoc;
  }
});
