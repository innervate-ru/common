import test from 'ava'

import TypeBuilder from './TypeBuilder'

test(`создание простого типа`, t => {
  const typeBuilder = new TypeBuilder({name: 'AType'});

  t.is(typeBuilder.build(), undefined); // ни одного типа не добавлено

  typeBuilder.addField({name: 'field1', type: 'Int'}); // аргументов нет
  typeBuilder.addField({name: 'field2', args: [`n: Int`, 's: String!'], type: 'String!'}); // аргументы массивом
  typeBuilder.addField({name: 'field3', args: `n: Int, s: String!`, type: 'String!'}); // аргументы одной строкой

  t.is(typeBuilder.build(),
    `type AType {
field1: Int,
field2(
n: Int,
s: String!,): String!,
field3(
n: Int, s: String!): String!
}`);
});

test(`форматирование комментариев`, t => {
  const typeBuilder = new TypeBuilder({name: 'AType'});

  typeBuilder.addField({description: `одна строка`, name: `а`, type: 'Int'});
  typeBuilder.addField({description: `строка один\nстрока два\nстрока три`, name: `b`, type: 'Int'});
  typeBuilder.addField({description: `# строка один\n#  строка два\n#   строка три`, name: `с`, type: 'Int'}); // вариант с ручным форматированием результата, с указанием начала строки решеткой

  typeBuilder.setDescription(`Тестовый тип чтобы\n#   - проверить комментарий для типа\n#   - проверить комментарии для полей`)

  t.is(typeBuilder.build(),
    `# Тестовый тип чтобы
#   - проверить комментарий для типа
#   - проверить комментарии для полей
type AType {
# одна строка
а: Int,
# строка один
# строка два
# строка три
b: Int,
# строка один
#  строка два
#   строка три
с: Int
}`);

});

test(`комментарии над аргументами`, t => {
  const typeBuilder = new TypeBuilder({name: 'AType'});

  typeBuilder.addField({
    name: 'a', type: 'Int', args: [
      {name: `arg1`, type: `Int`, description: `Первый аргумент`},
      {name: `arg2`, type: `Int`, description: `Второй аргумент\nс описание в две строки`},
      {
        name: `arg3`, type: `String!`, description: `
      # Третий аргумент
      #    с форматированным описанием`
      },
      '# четвертый аргумент c комментарием прямо в строке\narg4: Boolean',
    ]
  });
  typeBuilder.addField({ // все аргументы одной строкой, с описанием внутри
    name: `b`, type: `String`, args: `
# первый аргумент
arg1: Int,

# второй аргумент
# описание в две строки
arg2: String
`
  });

  t.is(typeBuilder.build(),
    `type AType {
a(
# Первый аргумент
arg1: Int,
# Второй аргумент
# с описание в две строки
arg2: Int,
      # Третий аргумент
      #    с форматированным описанием
arg3: String!,
# четвертый аргумент c комментарием прямо в строке
arg4: Boolean,): Int,
b(

# первый аргумент
arg1: Int,

# второй аргумент
# описание в две строки
arg2: String
): String
}`);

});
