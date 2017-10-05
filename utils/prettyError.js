import buildFullErrorMessage from './buildFullErrorMessage'
import reduceErrorStack from './reduceErrorStack'

export default function prettyError(error) {
  const newError = Object.create(error.__proto__);
  const message = newError.message = buildFullErrorMessage(error);
  newError.stack = reduceErrorStack(error, message);
  return newError;
}
