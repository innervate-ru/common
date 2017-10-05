import test from 'ava'

import addPrefixToErrorMessage from './addPrefixToErrorMessage'

test(`При получении ошибки, добавляем контекст в сообщение, и бросает ошибку дальше`, t => {
  try {
    try {
      throw new Error(`Test error`);
    } catch (err) {
      addPrefixToErrorMessage('context', err);
    }
    t.true(false); // мы не должны здесь оказаться, так как addPrefixToErrorMessage бросает ошибку дальше
  } catch (err) {
    t.is(err.message, 'context: Test error');
  }
});
