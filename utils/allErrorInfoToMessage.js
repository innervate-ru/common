import serializeError from 'serialize-error'
import prettyPrint from './prettyPrint'

/**
 * Возвращает Error, у которого message это json-строка, в которой есть все поля исходной ошибки, кроме stack и поле
 * stack скопированно из исходной ошибки.
 */
export default function (error) {
  const errorDesc = serializeError(error);
  if (typeof error.name == 'string') errorDesc.name = error.name;
  delete errorDesc.stack;
  const fullError = new Error(prettyPrint(errorDesc));
  fullError.stack = error.stack;
  return fullError;
}
