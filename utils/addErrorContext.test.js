import test from 'ava'

import addErrorContext from './addErrorContext'

test(`При получении ошибки, добавляем контекст в сообщение, и бросает ошибку дальше`, t => {
  try {
    try {
      throw new Error(`Test error`);
    } catch (err) {
      addErrorContext('context', err);
    }
    t.true(false); // мы не должны здесь оказаться, так как addErrorContext бросает ошибку дальше
  } catch (err) {
    t.is(err.message, 'context: Test error');
  }
});
