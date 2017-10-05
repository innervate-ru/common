import {missingArgument, invalidArgument} from '../validation'
import prettyPrint from './prettyPrint'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Добавляем в поле message объекта Error, другие свойства которые есть у ошибки, кроме поля stack.
 *
 * Внимание: Этот метод не изменяется объект error, так как может быть использован в момент передачи данных, при этом не должен портить исходную информацию в Error.
 */
export default function buildFullErrorMessage(error = missingArgument('error')) {

  if (!(typeof error === 'object' && error != null && !Array.isArray(error))) invalidArgument('error', error);

  let contextId;
  if (hasOwnProperty.call(error, 'context')) contextId = error.context.id;

  let extra;
  for (const fieldName in error) {
    if (!hasOwnProperty.call(error, fieldName)) continue;
    switch (fieldName) {
      case 'name': case 'message': case 'stack': case 'context': continue;
    }
    (extra || (extra = Object.create(null)))[fieldName] = error[fieldName];
  }
  if (!contextId && !extra) return error.toString();

  const name = (typeof error.name === 'string') ? error.name : 'Error';
  const message = (typeof error.message === 'string') ? error.message : undefined;
  return `${name}${contextId ? ` (${contextId})` : ''}: ${message}${extra ? ` ${prettyPrint(extra)}` : ''}`;
}
