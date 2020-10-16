/**
 * Билдер валидатора. В него передаются result, field, плюс параметры из func(param1, param2, ...) из аттрибута validate.
 * this - модель fields. field - описание поля
 */
export function greaterThanNumber(result, field, number) {
  const n = parseFloat(number);
  if (isNaN(n)) result.error('dsc.invalidArgument', {value: number});
  return function (result, value, doc) {
    if (!(value > n)) result.error('validate.mustBeGraterThen', {value, n});
  }
}
