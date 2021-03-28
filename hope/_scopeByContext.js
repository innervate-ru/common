import {invalidArgument, isResult} from '../validation/arguments'
import Result from "../../../../lib/hope/lib/result";

export default async function scopeByContext({context, result, connection, handler} = {}) {

  if (!(typeof context === 'string' && context.length > 0)) invalidArgument('context', context);
  if (!(result === undefined || isResult(result))) invalidArgument('result', result);
  if (!(connection === undefined || (typeof connection === 'object' && 'exec' in connection))) invalidArgument('connection', connection);
  if (!(typeof handler === 'function')) invalidArgument('handler', handler);

  let scope = (this._scopes || (this._scopes = Object.create(null)))[context];
  const newConnection = !connection;

  if (scope) {

    scope._ref++;
  } else {

    scope = this._scopes[context] = {

      _ref: 0,

      // TODO: update docs map/queue

      // TODO: actions stack

      connection: connection || await (async () => {

        const connection = await this._postgres.connection({context});

        // await connection.exec({
        //   context,
        //   statement: ``,
        // });

        return connection;
      })(),

      _close: async function (isSuccess) {

        if (--this._ref === 0) {

          delete this._scopes[context];

          if (!connection) {

            // await connection.exec({
            //   context,
            //   statement:
            //     isSuccess ?
            //       `` :
            //       ``,
            // });
          }
        }
      }
    };
  }

  const newResult = !result;
  if (newResult) result = new Result();

  const localResult = new Result();

  try {

    if (newConnection) {

      await connection.exec({
        context,
        statement: `start transaction;`,
      });
    }

    handler({scope, result});

  } catch (err) {

    // TODO: add system error
    // TODO: report to graylog

  } finally {

    if (localResult.messages.length > 0) {

      result.info('doc.scope', ); // TODO: add scope info

      result.add(localResult);
    }

    if (newConnection) {
      if (result.isError) {

        await connection.exec({
          context,
          statement: `rollback`,
        });

        if (newResult) {

          result.throwIfError();
        }
      } else {

        await connection.exec({
          context,
          statement: `commit`,
        });
      }
    }

    await connection.end();
  }
};
