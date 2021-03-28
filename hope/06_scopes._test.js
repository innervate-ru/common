import test from 'ava'

import Result from '../../../../lib/hope/lib/result/index'

// scope нужен для объединения операций в hope.invoke в одну транзакцию. например чтоб есди hope.invoke вызван одновременно
// с параметром update и параметром action, то оба эих действия выполнялись в одной транзакции. и если, например, action на новом
// только чтоб созданном документе вернул ошибку, то вся операция зканчивается ошибкой, транзакция откатывается и в результате
// новый документ не создается.

// так же в пределах scope группируются вложенные операции и есть защита от их зацикленности. например, в рамках update можно
// создать / обновить документ на который будет ссылка через поле refers.  при этом если в рамках этой вложенности дойдет до обновления,
// например, документа с которого началась цепочка. то будет отказ в виде warning'а. то же произойдет если в рамках action повторно будет
// вызванно дойствие для документа (instance), которое уже есть в цепочке.

// операции с БД нужно выполнять используя scope.connection.
// если это создание scope и не передан параметр connection, то connection создается на основе свойста сервиса hope - this._postgres.
test.serial.only(`6.1 scopes`, async t => {

  const {testDocsSvc: hope} = t.context.manager.services;

  hope._scopeByContext({
    context: 'contextA',
    handler: (scope, result) => {

      scope.connection.exec({
        context: 'contextA',
        statement: 'select * from doc_doc_1 limit 1',
      });

    // scope({
    //   docType: 'doc1',
    //   docId: '123',
    //   action: 'update',
    // });

  }});
});

// если scope создан без параметра result, то в случае ошибки будет выброшен exception.
test.serial.only(`6.2 scopes`, async t => {

  const {testDocsSvc: hope} = t.context.manager.services;

  const result = new Result();

  hope._scopeByContext({
    context: 'contextA',
    result,
    handler: (scope, result) => {

      result.error('test.error');
    }});

  t.deepEqual(result.messages, []);

  t.throws(() => { hope._scopeByContext({
    context: 'contextA',
    handler: (scope, result) => {

      result.error('test.error');
    }})});
});

// можно передать connection как параметр scope. оно будет использовано как scope.connection, если ещё не существует scope для данного context.

// описание шага scope можно переопределять через вызов scope({...}).
// проверка на повтор операции происходит в момент вызова scope({...}).  если это повтор то scope() возвращает false и добавляет в result соотвествующий warning.

// при возникновении ошибок и просто информационных сообщений в result добавляется info сообщение с детально расписанном scope
