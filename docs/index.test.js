import path from 'path'
import test from 'ava'
import {testResetCounters} from '../monitoring/index'

test.before(t => {
  deleteRequireCache(require.resolve('./testDocsSvc'));
});

test.beforeEach(async t => {

  testResetCounters();

  const consoleAndBusServicesOnly = Object.create(null);
  consoleAndBusServicesOnly.testMode = {docs: true};
  consoleAndBusServicesOnly.console = t.context.testConsole = new (require('../utils/testConsole').default)();
  consoleAndBusServicesOnly.bus = new (require('../events/index').Bus(consoleAndBusServicesOnly))({nodeName: 'test'});

  const eventLoader = require('../services/defineEvents').default(consoleAndBusServicesOnly);
  await eventLoader(path.join(process.cwd(), 'src'));

  const manager = t.context.manager = new (require('../services/index').NodeManager(consoleAndBusServicesOnly))({
    name: 'test',
    services: [
      require('../../services/postgres/index'),
      require('./testDocsSvc'),
    ],
  });

  await manager.started;
});

require('./01_insertUpdateRead._test');
require('./02_createUpdateDeleteRestoreDoc._test');
require('./03_actionsOnDoc._test');
require('./04_getDoc._test');
require('./05_listDocs._test');
require('./10_states._test');
require('./20_userRights._test');

function deleteRequireCache(id) {
  if (!id || ~id.indexOf('node_modules')) return;
  const m = require.cache[id];
  if (m !== undefined) {
    Object.keys(m.children).forEach(function (file) {
      deleteRequireCache(m.children[file].id);
    });
    delete require.cache[id];
  }
}
