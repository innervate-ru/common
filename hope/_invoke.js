import md5 from 'md5'
import oncePerServices from '../services/oncePerServices'
import Result from '../../../../lib/hope/lib/result/index'
import requestByContext from '../context/requestByContext'

const debug = require('debug')('hope.update');

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;
  const testMode = __testMode && __testMode.hope;

  const insertRow = require('./_insertRow').default(services);
  const updateRow = require('./_updateRow').default(services);
  const build = require('./_buildDoc').default(services);

  return async function invoke(args) {

    schema.invoke_args(args);

    const {context, type, http, docId, action, mask = '#all', refersMask = '#short'} = args;
    let {update, actionArgs} = args;

    const user = requestByContext(context)?.user;

    const newResult = !args.result;
    const result = args.result || new Result();

    const localResult = new Result();

    // const connection = args.connection || (await this._postgres.connection({context}));
    const connection = args.connection || this._postgres;

    //
    // process type
    //

    const docDesc = this._model().docs[type];
    if (!docDesc) {
      result.error(`doc.unknownType`, {docType: type});
      if (newResult) result.throwIfError(); else return;
    }

    //
    // process update
    //

    // basic validate update

    debug(`update: doc: %o`, update);

    if (update) {

      docDesc.$$validate(localResult, update, {beforeAction: false, strict: true, mask: docDesc.fields.$$tags.all});
      if (localResult.isError) {
        result.error(`doc.wrongUpdateArgs`, {docType: type, step: 1});
        result.add(localResult);
        if (newResult) result.throwIfError(); else return;
      }

      if (http) {
        update = await this.httpFix({context, result, fields: update, fieldsDesc: docDesc.fields, isOut: false});
        if (localResult.isError) {
          result.error(`doc.failedToFixUpdate`, {docType: type});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      }
    }

    let newDoc = update;
    let existingDoc;

    const runActionCode = async (actionDesc) => {
      let res;
      if (actionDesc.$$code) {
        try {

          res = await Promise.resolve(actionDesc.$$code({
            context,
            result: localResult,
            doc: newDoc,
            prevDoc: existingDoc,
            docDesc,
            actionDesc,
            model: this._model(),
          }));

          if (res?.doc) {
            newDoc = res.doc;
            delete res.doc;
          }

          return res;

        } catch (err) {
          err.context = context;
          this._service._reportError(err);
          result.error(`doc.systemError`, {context});
          if (newResult) result.throwIfError(); else return false;
        }

        if (localResult.isError) {
          result.error(`doc.failedActionCode`, {docType: type, action: actionDesc.name});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return false;
        }
      }
    };

    // get existing doc for update
    if (docId || update?.hasOwnProperty('id')) {

      // TODO: Check docType level retrieve right
      const statement = `select * from ${docDesc.$$table} where id = $1;`;
      const r = await connection.exec({
        context,
        name: md5(statement),
        statement,
        params: [docId || update.id],
      });
      if (r.rowCount === 0) {
        result.error('doc.notFound', {docType: type, docId: testMode ? '' : update?.id});
        if (newResult) result.throwIfError(); else return;
      }
      const retrieveMask = docDesc.fields.$$calc('#all-options');
      newDoc = existingDoc = docDesc.fields.$$fix(await build('context', result, docDesc, r.rows[0], retrieveMask, 'id'), {mask: retrieveMask});

      if (false === await runActionCode(docDesc.actions.retrieve)) return; // TODO: Think of

    } else {
      // TODO: Check docType level create right

      newDoc = update;

      if (false === await runActionCode(docDesc.actions.create)) return;

      if (!newDoc) newDoc = docDesc.fields.$$new();

      existingDoc = newDoc;
    }

    debug(`update: newDoc: %o`, newDoc);

    let access;
    if (update) {

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
          result.error('doc.tooManyUpdateCycles', {docType: type, docId: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        // apply update
        const state = newDoc.state;

        newDoc = docDesc.fields.$$set(newDoc, update, {
          updateMask: docDesc.fields.$$calc('id,rev,deleted').or(access.update),
          newVal: false
        });
        if (state) newDoc.state = state;

        debug(`update: newDoc[%d]: %o`, i, newDoc);
      }

      docDesc.$$validate(localResult, update, {
        access,
        beforeAction: false,
        strict: true,
        mask: access.update.add('id,rev,deleted'),
      });
      if (localResult.isError) {
        result.error(`doc.wrongUpdateArgs`, {docType: type, docId: newDoc.id, step: 2});
        result.add(localResult);
        if (newResult) result.throwIfError(); else return;
      }

      // is this existing document?
      if (update.hasOwnProperty('id')) {

        if (!access.actions.get(docDesc.actions.retrieve.$$index)) {
          result.error(`doc.notAvailable`, {docType: type, docId: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        if (false === await runActionCode(docDesc.actions.retrieve)) return; // TODO: ???

        if (!access.actions.get(docDesc.actions.update.$$index)) {
          result.error(`doc.cannotUpdate`, {docType: type, docId: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        if (false === await runActionCode(docDesc.actions.update)) return;

        if (localResult.isError) {
          result.error(`doc.failedToUpdate`, {docType: type, docId: testMode ? '' : newDoc?.id});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

        if (newDoc.deleted) {

            if (!access.actions.get(docDesc.actions.restore.$$index)) {
              result.error(`doc.cannotRestore`, {docType: type, docId: newDoc.id});
              if (newResult) result.throwIfError(); else return;
            }

            if (false === await runActionCode(docDesc.actions.restore)) return;

        } else {

            if (!access.actions.get(docDesc.actions.delete.$$index)) {
              result.error(`doc.cannotDelete`, {docType: type, docId: newDoc.id});
              if (newResult) result.throwIfError(); else return;
            }

            if (false === await runActionCode(docDesc.actions.delete)) return;

        }

        // TODO: build difference. if none do not update

        // update document
        newDoc = docDesc.fields.$$get(newDoc, docDesc.fields.$$calc('id,rev,deleted').or(access.view).or(access.update));
        newDoc = await updateRow.call(this, context, localResult, connection, docDesc, newDoc, docDesc.fields.$$calc(mask), refersMask);
        if (localResult.isError) {
          result.error(`doc.updateFailedToWrite`, {docType: type, docId: testMode ? '' : newDoc?.id});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

      } else { // new doc

        if (!access.actions.get(docDesc.actions.create.$$index)) { // TODO: Is this right place?
          result.error(`doc.cannotCreate`, {docType: type, docId: newDoc.id});
          if (newResult) result.throwIfError(); else return;
        }

        if (false === await runActionCode(docDesc.actions.update)) return;

        if (localResult.isError) {
          result.error(`doc.failedToCreate`, {docType: type, docId: testMode ? '' : newDoc?.id});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

        // create document
        newDoc = docDesc.fields.$$get(newDoc, access.view.or(access.update).remove('#computed', {strict: false}));

        newDoc = await insertRow.call(this, context, localResult, connection, docDesc, newDoc, docDesc.fields.$$calc(mask), refersMask);
        if (localResult.isError) {
          result.error(`doc.createFailedToWrite`, {docType: type, docId: testMode ? '' : newDoc?.id});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      }

      // TODO: Log history

    }

    //
    // process action
    //

    let actionDesc, actionResult;

    if (action) {

      debug(`action: %o`, action)

      actionDesc = docDesc.actions[action];

      if (!actionDesc) {
        result.error('doc.unknownAction', {docType: type, docId: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      if (docDesc.actions.$$tags.system.get(actionDesc.$$index)) {
        result.error('doc.systemActionCannotBeCalledDirectly', {
          docType: type,
          docId: testMode ? '' : newDoc.id,
          action
        });
        if (newResult) result.throwIfError(); else return;
      }

      if (actionDesc.arguments) {
        if (!actionArgs) {
          result.error('doc.actionArgsRequired', {docType: type, docId: testMode ? '' : newDoc.id, action});
          if (newResult) result.throwIfError(); else return;
        }
        actionDesc.arguments.$$validate(localResult, actionArgs, {beforeAction: true});
        if (localResult.isError) {
          result.error(`doc.invalidActionArgs`, {docType: type, docId: testMode ? '' : newDoc.id, action: action});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }

        if (http) {
          actionArgs = await this.httpFix({context, result: localResult, fields: actionArgs, fieldsDesc: actionDesc.arguments, isOut: false});
          if (localResult.isError) {
            result.error(`doc.failedToFixActionArgs`, {docType: type, docId: testMode ? '' : newDoc.id, action: action});
            result.add(localResult);
            if (newResult) result.throwIfError(); else return;
          }
        }


      } else if (actionArgs) {
        result.error('doc.actionArgsNotExpected', {docType: type, docId: testMode ? '' : newDoc.id, action});
        if (newResult) result.throwIfError(); else return;
      }

      if (actionDesc.static) {

        if (actionDesc.$$code) {

          try {
            actionResult = await Promise.resolve(actionDesc.$$code({
              context,
              result: localResult,
              doc: newDoc,
              args: actionArgs,
              docDesc,
              actionDesc,
              model: this._model(),
            }));

            actionResult = await  Promise.resolve(actionResult);

          } catch (err) {
            err.context = context;
            this._service._reportError(err);
            result.error(`doc.systemError`, {context});
            if (newResult) result.throwIfError(); else return;
          }

          debug(`action: res: %o`, actionResult);

          if (localResult.isError) {
            result.error(`doc.failedActionCode`, {docType: type, action: actionDesc.name});
            result.add(localResult);
            if (newResult) result.throwIfError(); else return;
          } else if (localResult.messages.length > 0) {
            result.add(localResult);
          }
        }

        return actionResult?.result ? {result: actionResult.result} : {};

      } else {

        if (!access) {
          access = docDesc.$$access(newDoc)
        }

        if (!access.actions.get(actionDesc.$$index)) {
          result.error('doc.actionIsNotAvailable', {docType: type, docId: testMode ? '' : newDoc.id, action});
          if (newResult) result.throwIfError(); else return;
        }

        if (!actionDesc.skipValidate) {
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
            docId: testMode ? '' : newDoc.id,
            state: newDoc.state,
            action
          });
          if (newResult) result.throwIfError(); else return;
        }

        let actionUpdate;
        if (actionDesc.$$code) {

          try {
            actionResult = await Promise.resolve(actionDesc.$$code({
              context,
              result: localResult,
              doc: newDoc,
              args: actionArgs,
              nextState: transitionDesc?.next.name,
              docDesc,
              actionDesc,
              model: this._model(),
            }));

            actionResult = await Promise.resolve(actionResult);

          } catch (err) {
            err.context = context;
            this._service._reportError(err);
            result.error(`doc.systemError`, {context});
            if (newResult) result.throwIfError(); else return;
          }

          debug(`action: res: %o`, actionResult);

          if (localResult.isError) {
            result.error(`doc.failedActionCode`, {docType: type, action: actionDesc.name});
            result.add(localResult);
            if (newResult) result.throwIfError(); else return;
          } else if (localResult.messages.length > 0) {
            result.add(localResult);
          }

          if (actionDesc.result) {
            actionDesc.result.$$validate(result, actionResult.result);
            if (localResult.isError) {
              result.error(`doc.invalidActionCodeResult`, {docType: type, action: actionDesc.name});
              result.add(localResult);
              if (newResult) result.throwIfError(); else return;
            }
          } else {
            if (actionResult?.result) {
              result.error(`doc.unexpectedActionCodeResult`, {value: actionResult.result, docType: type, action: actionDesc.name});
              if (newResult) result.throwIfError(); else return;
            }
          }

          if (typeof actionResult === 'object' && actionResult !== null && !Array.isArray(actionResult)) {

            if (actionResult.update) {

              actionUpdate = docDesc.fields.$$fix(actionResult.update, {newVal: false});

              docDesc.$$validate(localResult, actionUpdate, {mask: docDesc.fields.$$tags.all});
              if (localResult.isError) {
                result.error(`doc.invalidUpdateFromActionCode`, {
                  docType: type,
                  docId: testMode ? '' : newDoc.id,
                  action: action,
                  step: 1,
                });
                result.add(localResult);
                if (newResult) result.throwIfError(); else return;
              }
            }
            if (actionResult.state) {
              if (!docDesc.states[actionResult.state]) {
                result.error('doc.actionCodeReturnedUnknownState', {
                  docType: type,
                  docId: testMode ? '' : newDoc.id,
                  state: actionResult.state,
                  action,
                });
                if (newResult) result.throwIfError(); else return;
              }
              (actionUpdate || (actionUpdate = {})).state = actionResult.state;
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
              docId: testMode ? '' : newDoc.id,
              action: action,
              step: 2,
            });
            result.add(localResult);
            if (newResult) result.throwIfError(); else return;
          }

          // update document
          newDoc = docDesc.fields.$$get(newDoc, access.view.add(access.update).add('id,rev,state,deleted').lock());
          newDoc = await updateRow(context, localResult, connection, docDesc, newDoc, docDesc.fields.$$calc(mask).remove('options').lock(), refersMask);
          if (localResult.isError) {
            result.error(`doc.failedToWriteActionUpdate`, {
              docType: type,
              docId: testMode ? '' : newDoc?.id,
              action: action
            });
            result.add(localResult);
            if (newResult) result.throwIfError(); else return;
          }
        }

        // TODO: Log history

      }
    }

    if (testMode) {
      if (newDoc.created) newDoc.created = '';
      if (newDoc.modified) newDoc.modified = '';
    }

    if (http) {

      newDoc = await this.httpFix({context, result: localResult, fields: newDoc, fieldsDesc: docDesc.fields, isOut: true});

      if (localResult.isError) {
        result.error(`doc.failedToFixDoc`, {docType: type});
        result.add(localResult);
        if (newResult) result.throwIfError(); else return;
      }
    }

    const r = {doc: newDoc};

    if (actionResult?.result) {
      if (http) {
        r.result = await this.httpFix({context, result: localResult, fields: actionResult.result, fieldsDesc: actionDesc.result, isOut: true});
        if (localResult.isError) {
          result.error(`doc.failedToFixResulr`, {docType: type});
          result.add(localResult);
          if (newResult) result.throwIfError(); else return;
        }
      } else {
        r.result = actionResult.result;
      }
    }
    return r;
  }
});
