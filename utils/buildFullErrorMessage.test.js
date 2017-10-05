import test from 'ava'

import buildFullErrorMessage from './buildFullErrorMessage'

test(`просто ошибка`, t => {
  const err = new Error('Some reason');
  t.is(buildFullErrorMessage(err), err.toString());
  t.is(buildFullErrorMessage(err), `Error: Some reason`);
});

test(`ошибка c названием`, t => {
  class NamedError extends Error {
  }
  NamedError.prototype.name = 'NamedError'; // по спецификации своство name используется в Error.toString()
  const err = new NamedError('Some reason');
  t.is(buildFullErrorMessage(err), err.toString());
  t.is(buildFullErrorMessage(err), `NamedError: Some reason`);

});

test(`ошибка содержащая дополнительные поля`, t => {
  class ErrorWithDetails extends Error {
    constructor(reason, details) {
      super(reason);
      this.details = details;
    }
  }
  ErrorWithDetails.prototype.name = 'ErrorWithDetails'; // по спецификации своство name используется в Error.toString()
  const err = new ErrorWithDetails('Some reason', {a: 12, b: 'a string'});
  t.is(buildFullErrorMessage(err), `ErrorWithDetails: Some reason {details: {a: 12, b: 'a string'}}`);
});

