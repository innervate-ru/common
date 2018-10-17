import {missingArgument, invalidArgument} from '../validation'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Добавляет в ошибку идентрификатор контекста.  Использовать когда ошибка возникла в собственном коде сервиса, и у вызова есть
 * параметр context {строка}.
 */
export default function bindErrorToContext(error = missingArgument('error'), context = missingArgument('context')) {
  if (!(typeof error === 'object' && error !== null && !Array.isArray(error))) invalidArgument('error', error);
  if (!(typeof context === 'string' && context.length > 0)) invalidArgument('context', context);

  if (hasOwnProperty.call(error, 'context')) {
    if (error.context.id !== context) {
      error.context.stack.push(`Context being replaced to '${error.context.id}'`);
      error.context.id = context;
    }
  } else {
    const errorContext = error.context = Object.create(null);
    errorContext.id = context;
  }
}

