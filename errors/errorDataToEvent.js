import buildFullErrorMessage from '../utils/buildFullErrorMessage'
import reduceErrorStack from '../utils/reduceErrorStack'

/**
 * Заполняет сообщение для шины, на основе данных объекта типа Error.
 */
export default function errorDataToEvent(error, event) {
  const message = event.errorMessage = buildFullErrorMessage(error); // stack и context в полное название не включаются
  event.errorStack = reduceErrorStack(error, message);
  if (hasOwnProperty.call(error, 'context')) event.context = error.context;
};
