import test from 'ava'

import typePrefix from './typePrefix'

test(`полеучени префикса для разных директори windows`, t => {
  t.is(typePrefix(`C:\\SVN\\Fesco\\fesco_lk_js_v2\\server\\src\\services\\cyberlines`), `cyberlines_`);
  t.is(typePrefix(`C:\\SVN\\Fesco\\fesco_lk_js_v2\\server\\src\\services\\cyberlines\\data\\v1`), `cyberlines_data_v1_`);
  t.is(typePrefix(`C:\\SVN\\Fesco\\fesco_lk_js_v2\\server\\src\\svc2\\v1`), `svc2_v1_`); // нет services
  t.is(typePrefix(`C:\\SVN\\Fesco\\fesco_lk_js_v2\\server\\svc2\\v1`), `svc2_v1_`); // нет services и src
});

test(`полеучени префикса для разных директори unix`, t => {
  t.is(typePrefix(`src/services/cyberlines`), `cyberlines_`);
  t.is(typePrefix(`src/services/cyberlines/data/v1`), `cyberlines_data_v1_`);
});
