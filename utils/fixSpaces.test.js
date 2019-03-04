import test from 'ava';
import fixSpaces from './fixSpaces';

test('test of function usage', (t) => {
  t.is(fixSpaces(' testing '), 'testing');
  t.is(fixSpaces('test  ing '), 'test ing');
  t.is(fixSpaces(' t  e  s  t  i  n  g '), 't e s t i n g');
  t.is(fixSpaces('            testing'), 'testing');
  t.is(fixSpaces('testing'), 'testing');
  t.is(fixSpaces('t  esting'), 't esting');

  // test with spaces
  t.is(fixSpaces('\n \n \n \n \n \n testing \n \n \n \n'), 'testing');
  t.is(fixSpaces('\n \n test\ning '), 'test ing');
  t.is(fixSpaces('\n \n t\ne\ns\nt\ni\nn\ng \n \n'), 't e s t i n g');
});

test.failing('fail of function', (t) => {
  t.is(fixSpaces(123), '123');
  t.fail();
});
