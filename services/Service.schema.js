import missingService from './missingService'
import prettyPrint from '../utils/prettyPrint'
import {VType, validateEventFactory, BaseEvent} from '../events'
import {validateAndCopyOptionsFactory} from '../validation'

import {NOT_INITIALIZED, WAITING_OTHER_SERVICES_TO_START, INITIALIZING, STOPPED, STARTING} from './Service.states'

const rootContext = () => ``;

/**
 * Проверяет что все элементы списка, и вложенных списков являются сервисами - содержат поле _service.
 * Результат - массив индексов элементов, которые не являются сервисами.
 */
function everyIsAService(context, list, indecies) {
  let i;
  innerContext = `${context()}[${i}]`;
  for (i = 0; i < list.length; i++) {
    const item = list[i];
    if (Array.isArray(item)) {
      indecies = everyIsAService(innerContext, item, indecies) || indecies;
    }
    else if (!(typeof s === 'object' && s !== null && hasOwnProperty.call(s, '_service'))) {
      (indecies || (indecies = ([])).push(context()));
    }
  }
  return indecies;
}

export const ServiceClassOptions = validateAndCopyOptionsFactory({
  dependsOn: {
    type: VType.Array(),
    validator: (dependsOn) => {
      const indecies = everyIsAService(rootContext(), dependsOn);
      return indecies ? `Not a services ${indecies.join(', ')}` : true;
    }
  },
  failRecoveryInterval: {type: VType.Int().positive()},
});

const MsSqlConnectorService = require('../connectors/MsSqlConnector.serviceType').SERVICE_TYPE;
const PGConnectorService = require('../connectors/PGConnector.serviceType').SERVICE_TYPE;
const SoapConnectorService = require('../connectors/SoapConnector.serviceType').SERVICE_TYPE;

export function defineEvents({bus = missingService('bus'), testMode}) {

  bus.registerEvent([
        // service.state
        {
          kind: 'event',
          type: 'service.state',
          validate: validateEventFactory({
            _extends: BaseEvent,
            state: {type: VType.String().notEmpty(), required: true},
            prevState: {type: VType.String().notEmpty(), required: true},
            serviceType: {type: VType.String().notEmpty()},
            reason: {type: VType.String()}, // причина перехода в состояние FAILED - поле message из Error
          }),
          toString: (ev) => {
            // Чтобы не сбивать с толку, при начальном запуске не выводим сообщение что сервис перешел в состояние stopped
            switch (ev.state) {
              case STOPPED:
                // не выводим сообщение что объект остановлен, при первом старте объекта - чтоб не сбивать читателя с толку
                if (ev.prevState === NOT_INITIALIZED || ev.prevState === WAITING_OTHER_SERVICES_TO_START || ev.prevState === INITIALIZING) return;
                break;
              case STARTING:
                // не выдаем сообщения о том что сервис стартует, если этот сервис выдает сообщение что он стартует с параметрами - см. событие service.options ниже
                if (ev.serviceType === MsSqlConnectorService || ev.serviceType === PGConnectorService || ev.serviceType === SoapConnectorService)  return;
                break;
            }
            return `${ev.source}: state: '${ev.state}'${ev.reason ? ` (reason: '${ev.reason}')` : ``}`
          },
        },
        // service.error
        {
          kind: 'error',
          type: 'service.error',
          validate: validateEventFactory({ // TODO: Fix
            _extends: BaseEvent,
            message: {type: VType.String().notEmpty(), required: true},
            stack: {type: VType.String().notEmpty()},
          }),
          toString: (ev) =>
            testMode ? `${ev.source}: error: '${ev.message}'` : // для testMode специальное сообщение, которое легко проверять и оно не содержит stack
              `${ev.source}: error '${ev.message}'\n${ev.stack}`,
        },
        // service.options
        {
          kind: 'info',
          type: 'service.options',
          validate: validateEventFactory({ // TODO: Fix
            _extends: BaseEvent,
            serviceType: {type: VType.String().notEmpty()},
            options: {type: VType.Object()},
          }),
          toString(ev)  {
            switch (ev.serviceType) {
              case MsSqlConnectorService:
                return `${ev.source}: сonnecting to ${ev.options.url}:${ev.options.options.port} as '${ev.options.user}'. database is '${ev.options.options.database}'`;
              case PGConnectorService:
                return `${ev.source}: сonnecting to ${ev.options.url}:${ev.options.port} as '${ev.options.user}'. database is '${ev.options.database}'`;
              case SoapConnectorService:
                return `${ev.source}: сonnecting to ${ev.options.uri} as '${ev.options.login}'`;
            }
            return `${ev.source}: options: '${prettyPrint(ev.options)}'`;
          },
        },
      ]
    );
}
