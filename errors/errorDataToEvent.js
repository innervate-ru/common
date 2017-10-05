import buildFullErrorMessage from '../utils/buildFullErrorMessage'
import reduceErrorStack from '../utils/reduceErrorStack'

/**
 * Заполняет сообщение для шины, на основе данных объекта типа Error.
 */
export default function errorDataToEvent(error, event) {
  const message = event.message = buildFullErrorMessage(error); // stack и context в полное название не включаются
  event.stack = reduceErrorStack(error, message);
  if (hasOwnProperty.call(error, 'context')) event.context = error.context;
};
