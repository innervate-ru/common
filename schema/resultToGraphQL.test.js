import test from 'ava'

// import resultToGraphQL from './resultToGraphQL'

test.todo(`Сделать`)

// const schema1 = {
//   t.context.schema = {
//     gqlType: 'query',
//     name: 'p_ro_agreement_select',
//     procCall: `p_ro_agreement_select @email='tef2@online.siberia.net', @clnt_code_6='TIAOPA'`,
//     description: 'Список договоров',
//     params: [
//       {
//         name: 'email',
//         type: 'string',
//         length: 320,
//         required: true,
//         description: 'e-mail пользователя',
//       },
//       {
//         name: 'clnt_code_6',
//         type: 'string',
//         length: 6,
//         required: true,
//         description: 'Код клиента',
//       },
//     ],
//     result: [
//       {
//         name: 'clnt_code_6',
//         type: 'string',
//         length: 6,
//         mssqlType: 'char',
//         description: 'Код клиента',
//       },
//       {
//         name: 'agr_uid',
//         type: 'int',
//         notNull: true,
//         description: 'Идентификатор договора',
//       },
//       {
//         name: 'agr_number',
//         type: 'string',
//         length: 100,
//         mssqlType: 'varchar',
//         description: 'Номер договора',
//       },
//     ]
//   };
//
// test(`схема в которой есть раздел result`, t => {
//   t.is(resultToGraphQL({typeName: `AType`, schema: schema1}), ``);
// });
//
// test.skip(`схема в которой нет раздела result`, () => {
//
// });
//
// test.todo(`валидация содержимого result`);
