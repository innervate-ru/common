import serializeError from 'serialize-error'

/**
 * Возвращает Error, у которого message это json-строка, в которой есть все поля исходной ошибки, кроме stack и поле
 * stack скопированно из исходной ошибки.
 */
export default function (err) {
  const errorDesc = serializeError(err);
  if (typeof err.name == 'string') errorDesc.name = err.name;
  delete errorDesc.stack;
  const fullError = new Error(JSON.stringify(errorDesc));
  fullError.stack = err.stack;
  return fullError;
}
