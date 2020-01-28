import missingService from '../../services/missingService';
import oncePerServices from '../../services/oncePerServices';

import { VType, validateEventFactory, BaseEvent } from '../../events/index'

export default oncePerServices(function defineEvents({ bus = missingService('bus') }) {

  bus.registerEvent([
    {
      kind: 'info',
      type: 'evolutions.dbCreated',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: server '${ev.settings.host}:${ev.settings.port}': database '${ev.settings.database}': created a new database`,
    },
    {
      kind: 'error',
      type: 'evolutions.noScripts',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: server '${ev.settings.host}:${ev.settings.port}': database '${ev.settings.database}': has no __scripts table. Cannot be updated`,
    },
    {
      kind: 'error',
      type: 'evolutions.sqlError',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: '${ev.filename}'${ev.scriptId ? ` (scriptId: ${ev.scriptId})` : ''}${ev.line !== undefined ? `: line ${ev.line}` : ''}: ${ev.errorMsg}`,
    },
    {
      kind: 'error',
      type: 'evolutions.locked',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: ${ev.errorMsg}`,
    },
    {
      kind: 'info',
      type: 'evolutions.change',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: '${ev.filename}': ${ev.change} file`,
    },
    {
      kind: 'info',
      type: 'evolutions.upToDate',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: no changes. database schema and code is all up to date`,
    },
    {
      kind: 'info',
      type: 'evolutions.applied',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: all changes were applied`,
    },
    {
      kind: 'info',
      type: 'evolutions.schemaLocked',
      validate: validateEventFactory(Object.assign({
        _extends: BaseEvent,
      })),
      toString: (ev) => `${ev.service}: database schema is locked`,
    },
  ]);
})
