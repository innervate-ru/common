import {missingArgument} from '../validation'

export default function addPrefixToErrorMessage(context = missingArgument('context'), error = missingArgument('error')) {
  error.message = `${context}: ${error.message}`;
  throw error;
}
