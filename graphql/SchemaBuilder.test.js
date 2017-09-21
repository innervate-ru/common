import test from 'ava'
import sinon from 'sinon'
import {missingArgument, invalidArgument} from '../utils/arguments'
import {SchemaBuilder, LevelBuilder} from './index'

test(`Если схема пустая, во время build() происходит ошибка`, async t => {
  const schemaBuilder = new SchemaBuilder();

  t.throws(() => schemaBuilder.build(), `Missing argument 'options'`); // пока не понял до конца, но когда ошибка при обработке параметров - то надо заварачивать в () =>
  t.throws(schemaBuilder.build({}), `Invalid argument \'options\': Missing required field \'typeDefs\'; Missing required field \'resolvers\'`); // а когда ошибка в коде, то не надо

  await t.throws(schemaBuilder.build({typeDefs: [], resolvers: {}}), `List of builders is empty`); // не добавлено ни одного builder'а

  schemaBuilder.addBuilder(async () => {}); // есть builder, но она ничего не добавляет
  schemaBuilder.build({typeDefs: [], resolvers: {}});
  await t.throws(schemaBuilder.build({typeDefs: [], resolvers: {}}), `Schema is empty`);

  // try {
  // } catch (err) {console.error(err.stack); throw err}

});

test(`Добавления простого query`, async t => {
  const schemaBuilder = new SchemaBuilder();
  const resolverStub = sinon.stub();
  schemaBuilder.addBuilder(async ({parentLevelBuilder, typeDefs = missingArgument('typeDefs'), resolvers = missingArgument('resolvers')}) => {
    parentLevelBuilder.addQuery({
      name: 'getSomething',
      type: 'MyType',
      typeDef: `type MyType {a: Int, b: String!}`,
      resolver: resolverStub,
    })
  });
  const typeDefs = [];
  const resolvers = Object.create(null);
  await schemaBuilder.build({typeDefs, resolvers});

  t.deepEqual(typeDefs, ['type MyType {a: Int, b: String!}', 'type RootQuery {getSomething: MyType}', 'schema Schema {query: RootQuery}']);
  t.deepEqual(resolvers, {getSomething: resolverStub});
});

test.todo(`Добавление простого mutation`);
test.todo(`Добавление query через LevelBuilder`);
test.todo(`Добавление mutation через LevelBuilder`);

test.only(`Добавление сложной иерархии, с указанием resolver'ов`, async t => {
  const schemaBuilder = new SchemaBuilder();
  const lvl1Builder = new LevelBuilder({name: 'lvl1'});
  const resolverStub1 = sinon.stub();
  const resolverStub2 = sinon.stub();
  schemaBuilder.addBuilder(lvl1Builder);
  lvl1Builder.addBuilder(async ({parentLevelBuilder, typeDefs = missingArgument('typeDefs'), resolvers = missingArgument('resolvers')}) => {
    parentLevelBuilder.addQuery({
      typeDef: `type q1Result {a: Int, b: String}`,
      name: 'q1',
      type: 'q1Result!',
      resolver: resolverStub1,
    });
    parentLevelBuilder.addMutation({
      name: 'q2',
      type: 'String',
      resolver: resolverStub2,
    });
  });

  const typeDefs = [];
  const resolvers = Object.create(null);
  await schemaBuilder.build({typeDefs, resolvers});

  t.deepEqual(typeDefs, [
    'type q1Result {a: Int, b: String}', // TODO: Make upper-case
    'type lvl1Query {q1: q1Result!}',
    'type lvl1Mutation {q2: String}',
    'type RootQuery {lvl1: lvl1Query}',
    'type RootMutation {lvl1: lvl1Mutation}',
    'schema {query: RootQuery, mutation: RootMutation}',
  ]);
  t.deepEqual(resolvers, {lvl1: {q1: resolverStub1, q2: resolverStub2}});
});

test.todo(`Если один из билдеров вернул ошибку, то весь процесс должен остановиться с этой ошибкой`);
