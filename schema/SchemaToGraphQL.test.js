import test from 'ava'
import path from 'path'

const base = path.basename(__filename, '.js');

// TODO: Код ниже для уже устаревшей версии SchemaToGraphQL  Надо написать новые тестыдля всех основных сценариев.  Но щас, увы, на это нет времени
test.todo(`${base}: Load schema component`);

// import path from 'path'
//
// import unionWithError from '../src/graphql/unionWithError'
//
// import {connectionArgs, connectionDefinitions, globalIdField} from 'graphql-relay'
//
// import {
//   GraphQLObjectType,
//   GraphQLBoolean,
//   GraphQLString,
//   GraphQLInt,
//   GraphQLFloat,
//   GraphQLNonNull,
//   GraphQLList,
//   GraphQLID,
// } from 'graphql'
//
// import SchemaToGraphQL from '../src/common/schema/SchemaToGraphQL'
//
// const base = path.basename(__filename, '.js');
//
// let sampleMethodSchema = {
//   name: 'sampleProc',
//   gqlType: 'query', // TODO: Check gqlType in play
//   params: [
//     {
//       name: 'param1',
//       type: 'string',
//       required: true,
//     },
//   ],
//   result: [
//     {
//       name: 'field1',
//       type: 'int'
//     },
//     {
//       name: 'field2',
//       type: 'boolean',
//       gqlHide: true,
//     }
//   ]
// };
//
// let rowType = 'test_sampleProc_row'
//
// let resultType = new GraphQLObjectType({
//   name: rowType,
//   fields: {
//     'field1': {
//       description: sampleMethodSchema.result[1].description,
//       type: GraphQLInt,
//     },
//   },
// });
//
// const {connectionType} = connectionDefinitions({
//   name: rowType,
//   nodeType: resultType,
// });
//
// let refTypeDef = {
//   name: 'test_sampleProc',
//   description: sampleMethodSchema.description,
//   args: {
//     'param1': {
//       description: sampleMethodSchema.params[0].description,
//       type: GraphQLString,
//     },
//   },
//   type: unionWithError(new GraphQLObjectType({
//     name: `test_sampleProc_rows`,
//     type: GraphQLInt,
//     fields: {
//       rows: {args: connectionArgs, type: connectionType},
//     },
//   })),
// };
//
// console.info('refTypeDef:', refTypeDef);
//
// let connectorStub = {
//   sampleProc() {
//
//   }
// };
//
// test(`${base}: Load schema component`, async t => {
//
//   let schemaToGraphQL = new SchemaToGraphQL({prefix: 'test'});
//
//   let types = {}, queries = {}, mutations = {};
//
//   let resolver = schemaToGraphQL.build({connector: sampleMethodSchema, method: sampleMethodSchema, types, queries, mutations});
//
//   t.deepEqual(types, {});
//   t.deepEqual(mutations, {});
//   t.is(Object.keys(queries).length, 1);
//
//   console.info(`queries['test_sampleProc']`, queries['test_sampleProc'])
//
//   t.deepEqual(queries['test_sampleProc'], refTypeDef);
//
//   //
//   //
//   // let builder = new ProcessBuilder()
//   //   .use('./src/schema/hideField');
//   //
//   // let types = {}, queries = {}, mutations = {};
//   //
//   // // TODO: Добавить дополнительную компоненту в процесс обработки - сказать какие файлы попробовать загрузить
//   // builder.buildSchema({method: sampleMethodSchema, types, queries, mutations});
//   //
//
// });
