import {invalidArgument, missingArgument} from '../validation'

export default function addErrorContext(context = missingArgument('context'), error = missingArgument('error')) {
  error.message = `${context}: ${error.message}`;
  throw error;
}

/*
export default class addErrorContext extends Error {
  constructor(context = missingArgument('context'), error = missingArgument('error')) {
    if (!(typeof context === 'string')) invalidArgument('context', context);
    if (!(error instanceof Error)) invalidArgument('error', error);
    super(`${context}: ${error.message}`);
    this.stack = error.stack;
  }
}
*/
