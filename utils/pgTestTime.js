import identity from 'lodash/identity'

/**
 * Заменяет в запросе now() на $n, где длина параметров плюс один, если метод получен в testMode.  Иначе параметры не меняет.
 *
 * Нужно для тестирования логики работы с БД, при включенном логическом тестовом времени.  Чтоб не зависить от времени на БД.
 */
export default function (testMode) {
  if (!testMode) return identity;
  return function ({statement, params, ...rest}) {
    const nowParam = params ?  `\$${params.length + 1}` : '$1';
    return {
      statement: statement.replace(/now\(\)/gi, nowParam),
      params:  params ? [...params, new Date()] : [new Date()],
      ...rest,
    }
  }
}
