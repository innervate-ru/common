export default async function scopeByContext(context, connection) {

  let scope = this._scopes[context];

  if (scope) {
    scope._ref++;
  }

  scope = this._scopes[context] = {

    _ref: 0,

    // TODO: update docs map/queue

    // TODO: actions stack

    connection: connection || await (async () => {

      const connection = await this._postgres.connection();

      await connection.exec({
        context,
        statement: ``,
      });

      return connection;
    })(),

    close: async function (isSuccess) {

      if (--this._ref === 0) {

        delete this._scopes[context];

        if (!connection) {

          await connection.exec({
            context,
            statement:
              isSuccess ?
                `` :
                ``,
          });
        }
      }
    }
  };

  return scope;
};
