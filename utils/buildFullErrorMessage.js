import {missingArgument, invalidArgument} from '../validation'
import prettyPrint from './prettyPrint'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Добавляем в поле message объекта Error, другие свойства которые есть у ошибки, кроме поля stack.
 *
 * Внимание: Этот метод не изменяется объект error, так как может быть использован в момент передачи данных, при этом не должен портить исходную информацию в Error.
 */
export default function buildFullErrorMessage(error = missingArgument('error')) {

  if (!(typeof error === 'object' && error !== null && !Array.isArray(error))) invalidArgument('error', error);

  let context;
  if (hasOwnProperty.call(error, 'context')) context = error.context;

  let extra;
  for (const fieldName in error) {
    if (!hasOwnProperty.call(error, fieldName)) continue;
    switch (fieldName) {
      case 'name': case 'message': case 'stack': case 'calls': case 'context': continue;
    }
    const v = error[fieldName];
    if (v !== undefined) (extra || (extra = Object.create(null)))[fieldName] = v;
  }
  if (!context && !extra) return error.toString();

  const name = (typeof error.name === 'string') ? error.name : 'Error';
  const message = (typeof error.message === 'string') ? error.message : undefined;
  return `${name}${context ? ` (${context})` : ''}: ${message}${extra ? ` ${prettyPrint(extra, 1000)}` : ''}`;
}
