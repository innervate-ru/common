import {VType, validate} from '../validation'

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

export const ctor_settings = validate.ctor.this({
  dependsOn: {
    type: VType.Array(),
    validator: (dependsOn) => {
      const indecies = everyIsAService(rootContext(), dependsOn);
      return indecies ? `Not a services ${indecies.join(', ')}` : true;
    }
  },
  failRecoveryInterval: {type: VType.Int().positive()},
});

export const serviceRestartLogic_result = validate.method.finished('serviceRestartLogic.result', {
  nextRestart: {required: true, type: VType.Int().zero().positive()}, // время, через которое надо повторить попытку запуска сервиса
  isQuickRestart: {required: true, type: VType.Boolean()}, // true, если это quick restart
});

