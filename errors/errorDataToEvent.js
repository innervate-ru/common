import buildFullErrorMessage from '../utils/buildFullErrorMessage'
import reduceErrorStack from '../utils/reduceErrorStack'

/**
 * Заполняет сообщение для шины, на основе данных объекта типа Error.
 */
export default function errorDataToEvent(error, event, field = `error`) {
  const message = buildFullErrorMessage(error);
  event[field] = {
    message,
    stack: reduceErrorStack(error, message),
  };
  if (hasOwnProperty.call(error, 'context')) {
    event.context = error.context.id;
    event.calls = error.context.stack;
  }
};
