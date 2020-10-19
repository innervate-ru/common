import md5 from 'md5'
import oncePerServices from '../services/oncePerServices'
import Result from '../../../../lib/hope/lib/result/index'
import buildDoc from './_buildDoc'
import requestByContext from "../context/requestByContext";

const debug = require('debug')('hope.list');

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    testMode: __testMode,
  } = services;
  const testMode = __testMode && __testMode.hope;

  return async function list(args) {
    schema.list_args(args);
    const {context, http, type, filter = {}, order = {}, pageSize = 25} = args;
    let {last = false, pageNo, pageExtra = 0, offset = 0, limit} = args;

    const user = requestByContext(context)?.user;

    const newResult = !args.result;
    const result = args.result || new Result();

    const connection = args.connection || this._postgres;

    debug('list: args: %o', args);

    //
    // process type
    //

    const docDesc = this._model().docs[type];
    if (!docDesc) {
      result.error(`doc.unknownType`, {docType: type});
      if (newResult) result.throwIfError(); else return;
    }

    //
    // process filter and sqlOrder
    //

    const sqlParams = [];
    const sqlWhere = [];
    const sqlOrder = [];

    const builder = docDesc.actions.list.$$code;
    if (builder) {
      try {
        const r = builder({
          context,
          result,
          sqlWhere,
          sqlOrder,
          sqlParams,
          filter,
          order,
          docDesc,
          model: this._model()
        });
        if (typeof r === 'object' && r !== null && !Array.isArray(r) && typeof r.then === 'function') await r;
      } catch (err) {
        err.context = context;
        this._service._reportError(err);
        result.error(`doc.systemError`, {context});
        if (newResult) result.throwIfError(); else return;
      }
    }

    if (filter.deleted) {
      sqlWhere.push(`deleted`)
    } else {
      sqlWhere.push(`not deleted`)
    }

    if (sqlOrder.length === 0) {
      sqlOrder.push(`created desc`)
    }

    //
    // select
    //

    if (pageNo === undefined) {

      const offsetLimit = [];
      if (typeof offset === 'number' && offset !== 0) {
        sqlParams.push(offset);
        offsetLimit.push(` offset $${sqlParams.length}`);
      }
      if (typeof limit === 'number') {
        sqlParams.push(limit);
        offsetLimit.push(` limit $${sqlParams.length}`);
      }

      const statement = `select * from ${docDesc.$$table} where ${sqlWhere.join(` and `)} order by ${sqlOrder.join(', ')}${offsetLimit.join('')};`;
      debug('list: sql: "%s"; params: %o', statement, sqlParams);
      const r = await connection.exec({
        context,
        name: md5(statement),
        statement,
        params: sqlParams,
      });

      let docs;

      if (http) {
        docs = r.rows.reduce((acc, v) => {
          let doc = buildDoc(docDesc, v);
          doc = this.httpFix({context, result, fields: doc, fieldsDesc: docDesc.fields, isOut: true});

          result.isError = false;
          docDesc.actions.retrieve.$$code?.({
            context,
            result,
            doc,
            docDesc,
            model: this._model
          });

          if (result.isError) {
            result.isError = false;
          } else {
            acc.push(doc);
          }

          // const access = docDesc.$$access(newDoc); // TODO: $$fix doc and $$get only fields viewable for given user
          /*
                    if (this.applyUserRights({context, result, doc})) {
                      acc.push(doc);
                    }
          */
          return acc;
        }, []);
        docs = await Promise.all(docs);
        if (result.isError) {
          if (newResult) result.throwIfError(); else return;
        }
      } else {
        docs = r.rows.map(v => buildDoc(docDesc, v));
      }

      if (testMode) {
        docs.forEach(d => {
          d.id = '';
          d.created = '';
          d.modified = '';
        });
      }

      return docs;

    } else {

      let docs, count;
      while (true) {

        if (last) { // select last page
          const statement = `select count(*)::integer from ${docDesc.$$table} where ${sqlWhere.join(` and `)}`;
          debug('list: sql: "%s"; params: %o', statement, sqlParams);
          const r2 = await connection.exec({
            context,
            name: md5(statement),
            statement,
            params: sqlParams,
          });
          count = r2.rows[0].count;
          pageNo = Math.trunc(count / pageSize) + 1;
        }

        offset = (pageNo - 1) * pageSize;
        limit = pageSize + Math.max(0, pageExtra - 1) * pageSize + 1;

        const offsetLimit = [];
        let sqlParamsWithOL = sqlParams.slice();
        if (typeof offset === 'number' && offset !== 0) {
          sqlParamsWithOL.push(offset);
          offsetLimit.push(` offset $${sqlParamsWithOL.length}`);
        }
        if (typeof limit === 'number') {
          sqlParamsWithOL.push(limit);
          offsetLimit.push(` limit $${sqlParamsWithOL.length}`);
        }

        const statement = `select id from ${docDesc.$$table} where ${sqlWhere.join(` and `)} order by ${sqlOrder.join(', ')}${offsetLimit.join('')};`;
        debug('list: sql: "%s"; params: %o', statement, sqlParamsWithOL);
        const r = await connection.exec({
          context,
          name: md5(statement),
          statement,
          params: sqlParamsWithOL,
        });

        if (r.rowCount === 0 && pageNo !== 1) {
          last = true;
          continue;
        }

        pageExtra = Math.max(0, Math.trunc((r.rows.length + pageSize - 1) / pageSize) - 1);
        if (pageExtra === 0 && !last) {
          last = true;
          count = offset + r.rowCount;
        }

        docs = r.rows.slice(0, pageSize);
        const statement2 = `select * from ${docDesc.$$table} where id = any($1::char(21)[]) order by ${sqlOrder.join(', ')}`;
        const docIdList = [docs.map(v => v.id)];
        debug('list: sql2: "%s"; params: %o', statement2, docIdList);
        const r2 = await connection.exec({
          context,
          name: md5(statement2),
          statement: statement2,
          params: docIdList,
        });

        if (http) {
          docs = r2.rows.reduce((acc, v) => {
            let doc = buildDoc(docDesc, v);
            doc = this.httpFix({context, result, doc, docDesc, isOut: true});
            if (doc) {
              acc.push(doc);
            }

            // TODO: How to apply user rights ???

            // const access = docDesc.$$access(newDoc); // TODO: $$fix doc and $$get only fields viewable for given user
            /*
                        if (this.applyUserRights({context, result, doc})) {
                          acc.push(doc);
                        }
            */
            return acc;
          }, []);
          docs = await Promise.all(docs);
          if (result.isError) {
            if (newResult) result.throwIfError(); else return;
          }
        } else {
          docs = r2.rows.map(v => buildDoc(docDesc, v));
        }

        if (testMode) {
          docs.forEach(d => {
            d.id = '';
            d.created = '';
            d.modified = '';
          });
        }

        break;
      }

      const res = {pageNo, pageExtra, last};

      if (last) {
        res.last = true;
        res.count = count;
      }

      res.docs = docs;

      return res;
    }
  }
});
