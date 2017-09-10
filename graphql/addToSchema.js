import throwIfMissing from 'throw-if-missing'

import {buildSchema} from 'graphql'


/**
 * Добавляет query и mutations в общую схему сервиса.  Для компиляции схемы использует buildSchema из пакета graphql.
 * Так как buildSchema возвращает результат, который по не понятным причинам не совсем подходит для передачи его в
 * *new GraphQLSchema()*, выполняется коррекция известных несоотвествий.
 *
 * В queries и mutations добавляются запросы и мутации найденный в схеме.  Если корневые элементы уже есть - выдается ошибка.
 */
export default function addToSchema({queries, mutations}, schema = throwIfMissing('schema')) {
  const schema = buildSchema(schema);





}
