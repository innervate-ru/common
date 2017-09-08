/**
 * Расширение для работы с типами для validateObject.  Цель, чтоб типы можно было писать в стиле:
 *
 * VType.Int
 * VType.String
 *
 * или с дополнительными условиями
 *
 * VType.Int.positive
 * VType.Int.zero.positive
 */

import util from 'util'
import {missingArgument, invalidArgument} from '../utils/arguments'
import prettyPrint from '../utils/prettyPrint'
import {messageInvalidFieldValue} from './validateObject'
import uniq from 'lodash/uniq'

const hasOwnProperty = Object.prototype.hasOwnProperty;

function _module() {

  /**
   * Мап типов:
   * ключ - имя типа
   * значение - исходная функция реализующая проверку типа
   *
   * Эта коллекция нужна, чтобы повторное определение типа с одной и тоже проверочной функцией не вызывало ошибки.
   */
  const pureValidators = Object.create(null);

  /**
   * Мап типов:
   * ключ - имя типа
   * значение - функция реализующая проверку типа
   */
  const types = Object.create(null);

  /**
   * Мап дополнительных проверок типов:
   * ключ - имя типа
   * значение - мап дополнительных проверок: ключ - доп. проверка, значение - метод доп. проверки
   */
  const subvalidators = Object.create(null);

  /**
   * Кешированные для повторного использование значения тип+доп.проверки:
   * ключ - <тип>_<доп.проверка1>_<доп.проверка2>..., где имена доп. проверок отсоритрованны по альфавиту
   * значение - общий метод проверки, с параметрами (fieldNamePrefix, fieldName, fieldDef)
   */
  const cachedValidators = Object.create(null);

  const VType = new Proxy(types, {

    has(target, name) {
      return hasOwnProperty.call(types, name);
    },

    set(target, name, value) {
      throw new Error(`It is not allowed to update types directly. (see addType())`);
    },

    get(target, name) {

      if (!hasOwnProperty.call(types, name)) throw new Error(`Type is not defined: '${name}'`);

      return types[name];
    }

  });

  /**
   * Добавляет тип в VTypes.  Имя типа (typeName) обязательно должно начинаться с большой латинской буквы.  Имя может содержать только
   * латинские буквы и цифры.  Метод проверки типа, должен быть функцией с одним аргумента - value, и возвращать true, если значение value
   * соотвествует этому типу.
   */
  function addType(typeName = missingArgument('typeName'), typePureValidator = missingArgument('typePureValidator')) {

    if (!(typeof typeName === 'string' && /^[A-Z]\w*$/.test(typeName))) invalidArgument('typeName', typeName);
    if (!(typeof typePureValidator === 'function' && typePureValidator.length === 1)) invalidArgument('typePureValidator', typePureValidator);

    if (hasOwnProperty.call(types, typeName)) {
      if (pureValidators[typeName] === typePureValidator) return;
      else throw new Error(`Type already defined: '${typeName}'`);
    }
    pureValidators[typeName] = typePureValidator;

    _addType(typeName, function (fieldNamePrefix, fieldName, fieldDef) {
      return function (value, message, validateOptions) {
        if (typePureValidator(value[fieldName])) return;
        (message || (message = [])).push(messageInvalidFieldValue(value, fieldNamePrefix, fieldName));
        return message;
      }
    });
  }

  /**
   * Добавляет тип в VTypes. В отличии от addType(), принимает полный валидатор для validateObject.  Это метод нужен,
   * чтоб добавлять сложные типы, как VType.Fields.
   */
  function addTypeAdvanced(typeName = missingArgument('typeName'), typeValidator = missingArgument('typeValidator')) {

    if (!(typeof typeName === 'string' && /^[A-Z]\w*$/.test(typeName))) invalidArgument('typeName', typeName);
    if (!(typeof typeValidator === 'function')) invalidArgument('typeValidator', typeValidator);

    if (hasOwnProperty.call(types, typeName)) {
      if (pureValidators[typeName] === typeValidator) return;
      else throw new Error(`Type already defined: '${typeName}'`);
    }
    pureValidators[typeName] = typeValidator;

    _addType(typeName, typeValidator);
  }

  function _addType(typeName, validate) {
    validate.toString = function () {
      return typeName;
    };
    types[typeName] = new Proxy(validate, {
      has(target, name) {
        if (name === '_vtype') return true;
        return name in types;
      },
      get(target, name) {
        if (name === util.inspect.custom || name === 'inspect' || name === 'name') return;
        if (name === 'call') return Function.prototype.call;
        if (name === Symbol.toPrimitive || name === 'valueOf' || name === 'toString') return target.toString;
        const typeSubvalidators = subvalidators[typeName];
        if (!typeSubvalidators || !hasOwnProperty.call(typeSubvalidators, name)) throw new Error(`Validator is not defined: '${typeName}.${name.toString()}'`);
        const context = {t: typeName, v: [name]};
        return new Proxy(buildValidator(context), subvalidatorProxyInterceptors(context));
      },
    });
  }

  const subvalidatorProxyInterceptors = (context) => ({
    get(target, name) {
      if (name === util.inspect.custom || name === 'inspect') return;
      if (name === util.inspect.custom) return;
      if (name === Symbol.toPrimitive || name === 'valueOf' || name === 'toString') return target.toString;
      const {t: typeName, v: subvalidatorsNames} = context;
      const typeSubvalidators = subvalidators[typeName];
      if (!typeSubvalidators || !hasOwnProperty.call(typeSubvalidators, name)) throw new Error(`Validator is not defined: '${typeName}.${name}'`);
      subvalidatorsNames.push(name);
      const newContext = {t: typeName, v: subvalidatorsNames};
      return new Proxy(buildValidator(newContext), subvalidatorProxyInterceptors(newContext));
    },
  });

  /**
   * Добавляет дополнительную or-проверку для указанного типа.
   */
  function addSubvalidator(vtype, subvalidatorName, subvalidator) {

    if (!(typeof vtype === 'string' || (typeof vtype === 'function' && hasOwnProperty.call(vtype, 'toString'))))  throw new Error(`Invalid argument 'vtype': ${prettyPrint(vtype)}`);
    if (!(typeof subvalidatorName === 'string')) throw new Error(`Invalid argument 'subvalidatorName': ${prettyPrint(subvalidatorName)}`);
    if (!(typeof subvalidator === 'function' && subvalidator.length === 1)) throw new Error(`Invalid argument 'subvalidator': ${prettyPrint(subvalidator)}`);

    const typeName = vtype.toString();
    const sv = (subvalidators[typeName] || (subvalidators[typeName] = Object.create(null)));
    if (hasOwnProperty.call(sv, subvalidatorName)) throw new Error(`Subvalidator '${subvalidatorName}' for type ${typeName} is already defined`);
    sv[subvalidatorName] = subvalidator;
  }

  /**
   * Собирает метод валидации для данного, по имени, типа и указанных списком or-проверок.
   *
   * Предполагается, что список or-проверок всегда не пустой.
   */
  function buildValidator({t: typeName, v: subvalidatorsNames}) {
    const normolizedSubvalidatorsList = uniq(subvalidatorsNames).sort();
    const key = `${typeName}_${normolizedSubvalidatorsList.join('_')}`;
    if (hasOwnProperty.call(cachedValidators, key)) return cachedValidators[key];

    const typePureValidator = pureValidators[typeName];
    const typeSubvalidators = subvalidators[typeName];

    const normolizedSubvalidators = normolizedSubvalidatorsList.map(v => typeSubvalidators[v]);

    let res;
    if (normolizedSubvalidators.length > 1) {
      res = function (fieldNamePrefix, fieldName, fieldDef) {
        return function (value, message, validationOptions) {
          const v = value[fieldName];
          if (typePureValidator(v, message, validationOptions)) // тип правильный
            for (const sv of normolizedSubvalidators)
              if (sv(v, message, validationOptions)) return; // одна из or-проверок прошла успешно
          (message || (message = [])).push(messageInvalidFieldValue(value, fieldNamePrefix, fieldName));
          return message;
        }
      };
    } else { // вариант результата оптимизированный под одну or-проверку
      const singleSubvalidator = normolizedSubvalidators[0];
      res = function (fieldNamePrefix, fieldName, fieldDef) {
        return function (value, message, validationOptions) {
          const v = value[fieldName];
          if (typePureValidator(v, message, validationOptions)) // тип правильный
            if (singleSubvalidator(v, message, validationOptions)) return; // одна из or-проверок прошла успешно
          (message || (message = [])).push(messageInvalidFieldValue(value, fieldNamePrefix, fieldName));
          return message;
        }
      };
    }

    res.toString = function() { return key; }

    return cachedValidators[key] = res;
  }

  /**
   * Возвращает внутренний метод проверки типа.  Это может быть полезно, чтобы делать дополнительные типы, на основе
   * уже объявленных.
   *
   * Параметр строка с именем типа, или VType-тип.
   */
  function getPureValidator(type = missingArgument('type')) {

    if (!(typeof type === 'string' || (typeof type === 'function' && '_vtype' in type))) invalidArgument('type', type);

    if (!hasOwnProperty.call(pureValidators, type.toString())) throw new Error(`Type is not defined: '${type}'`);

    return pureValidators[type];
  }

  return {
    VType,
    addType,
    addTypeAdvanced,
    subvalidatorProxyInterceptors,
    addSubvalidator,
    buildValidator,
    getPureValidator,
  }
}

module.exports = new _module();
module.exports._module = _module;
