import test from 'ava'

import SchemaToGraphQL from './SchemaToGraphQL_v1'

import SchemaBuilder from '../graphql/SchemaBuilder'

const method = {
  gqlType: 'query',
  name: 'some_proc',
  procCall: `some_proc @a = 12`,
  description: 'Тестовый метод',
  params: [
    {
      name: 'p1',
      type: 'string',
      required: true,
      description: 'описание',
    },
    {
      name: 'p2',
      type: 'int',
      description: 'описание',
    },
  ],
  result: [
    {
      name: 'f1',
      type: 'string',
      description: 'поле 1',
    },
    {
      name: 'f2',
      type: 'bool',
      description: 'поле 2',
    },
    {
      name: 'f3',
      type: 'int',
      required: true,
    },
  ],
};

const PREFIX = 'pref_';

test(`сборка простой схемы`, async t => {

  const testMethodBuilder = async (args) => {
    console.info(49);
    (new SchemaToGraphQL()).build({...args, serviceName: 'testSvc', PREFIX, method, connector: {_service: {}}})
    console.info(51);
  };

  const typeDefs = [], resolvers = {};
  await (new SchemaBuilder({test: testMethodBuilder})).build({typeDefs, resolvers});

  t.deepEqual(typeDefs, []);

});





