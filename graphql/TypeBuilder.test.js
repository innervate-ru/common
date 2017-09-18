import test from 'ava'

import TypeBuilder from './TypeBuilder'

test(`создание простого типа`, t => {
  const typeBuilder = new TypeBuilder({name: 'AType'});

  t.is(typeBuilder.build(), undefined); // ни одного типа не добавлено

  typeBuilder.addField({name: 'field1', type: 'Int'}); // аргументов нет
  typeBuilder.addField({name: 'field2', args: [`n: Int`, 's: String!'], type: 'String!'}); // аргументы массивом
  typeBuilder.addField({name: 'field3', args:`n: Int, s: String!'`, type: 'String!'}); // аргументы одной строкой

  t.is(typeBuilder.build(), `type AType {field1: Int, field2(n: Int, s: String!): String!, field3(n: Int, s: String!\'): String!}`);
});
