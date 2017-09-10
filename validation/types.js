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
import uniq from 'lodash/uniq'

const hasOwnProperty = Object.prototype.hasOwnProperty;

function _module() {

  /**
   * Мап типов:
   * ключ - имя типа
   * значение - функция реализующая проверку типа
   */
  const VType = Object.create(null);

  /**
   * Мап типов:
   * ключ - имя типа
   * значение - исходная функция реализующая проверку типа
   *
   * Эта коллекция нужна, чтобы повторное определение типа с одной и тоже проверочной функцией не вызывало ошибки.
   */
  const providedValidators = Object.create(null);

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

  const typesPrototypes = Object.create(null);

  const simpleTypeContextPrototype = {
    _build() {

      const typeName = this._vtype;
      const typePureValidator = providedValidators[typeName];
      let key, res;

      if (!hasOwnProperty.call(this, '_subvalidators')) { // простой тип, без дополнительных or-проверок

        key = typeName;
        if (hasOwnProperty.call(cachedValidators, key)) return cachedValidators[key];

        res = function (fieldNamePrefix, fieldName, fieldDef) {
          const invalidFieldValue = this.invalidFieldValue;
          if (!(typeof invalidFieldValue === 'function')) throw new Error(`invalidFieldValue not a function`);
          return function (value, message, validationOptions) {
            if (typePureValidator(value[fieldName])) return;
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        }

      } else { // тип с or-проверками

        const normolizedSubvalidatorsList = uniq(this._subvalidators).sort();
        key = `${typeName}_${normolizedSubvalidatorsList.join('_')}`;
        if (hasOwnProperty.call(cachedValidators, key)) return cachedValidators[key];

        const typeSubvalidators = subvalidators[typeName];

        const normolizedSubvalidators = normolizedSubvalidatorsList.map(v => typeSubvalidators[v]);

        if (normolizedSubvalidators.length > 1) {
          res = function (fieldNamePrefix, fieldName, fieldDef) {
            const invalidFieldValue = this.invalidFieldValue;
            return function (value, message, validationOptions) {
              const v = value[fieldName];
              if (typePureValidator(v, message, validationOptions)) // тип правильный
                for (const sv of normolizedSubvalidators)
                  if (sv(v, validationOptions)) return; // одна из or-проверок прошла успешно
              (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
              return message;
            };
          };
        } else {
          // вариант результата оптимизированный под одну or-проверку
          const singleSubvalidator = normolizedSubvalidators[0];
          res = function (fieldNamePrefix, fieldName, fieldDef) {
            const invalidFieldValue = this.invalidFieldValue;
            return function (value, message, validationOptions) {
              const v = value[fieldName];
              if (typePureValidator(v, validationOptions)) // тип правильный
                if (singleSubvalidator(v, validationOptions)) return; // одна из or-проверок прошла успешно
              (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
              return message;
            }
          };
        }
      }

      res.toString = function () {
        return key;
      };
      cachedValidators[key] = res;
      return res;
    },
    toString() {
      return this._vtype;
    },
  };

  function addType(typeName = missingArgument('typeName'), typePureValidator = missingArgument('typePureValidator')) {

    if (!(typeof typeName === 'string' && /^[A-Z]\w*$/.test(typeName))) invalidArgument('typeName', typeName);
    if (!(typeof typePureValidator === 'function' && typePureValidator.length === 1)) invalidArgument('typePureValidator', typePureValidator);

    if (typeName in providedValidators) {
      if (providedValidators[typeName] === typePureValidator) return;
      throw new Error(`Type '${typeName}' is already defined`);
    }
    providedValidators[typeName] = typePureValidator;
    addTypeAdvanced(typeName, function (typeContextPrototype) {
      const context = Object.create(typeContextPrototype);
      context._vtype = typeName;
      return function () {
        return context; // всегда возвращается один и тот же контекст.  если используется сабвалидатор, то создается новый контекст
      };
    });
  }

  function addTypeAdvanced(typeName, typeContextFactoryFactory) {
    const typeContextPrototype = typesPrototypes[typeName] = Object.create(simpleTypeContextPrototype);
    const typeContextFactory = typeContextFactoryFactory(typeContextPrototype);
    typeContextFactory.toString = function () {
      return `Instead VType.${typeName} use VType.${typeName}()`;
    };
    VType[typeName] = typeContextFactory;
  }

  /**
   * Возвращает внутренний метод проверки типа.  Это может быть полезно, чтобы делать дополнительные типы, на основе
   * уже объявленных.
   *
   * Параметр строка с именем типа, или VType-тип.
   */
  function getPureValidator(type = missingArgument('type')) {

    if (!(typeof type === 'string' || '_vtype' in type)) invalidArgument('type', type);

    const validator = providedValidators[type.toString()];

    if (!validator) throw new Error(`Type is not defined: '${type}'`);

    return validator;
  }

  function addSubvalidator(vtype, subvalidatorName, subvalidator) {

    if (!(typeof vtype === 'string' || (typeof vtype === 'object' && '_vtype' in vtype)))  throw new Error(`Invalid argument 'vtype': ${prettyPrint(vtype)}`);
    if (!(typeof subvalidatorName === 'string' && /^[a-z]\w*$/.test(subvalidatorName))) throw new Error(`Invalid argument 'subvalidatorName': ${prettyPrint(subvalidatorName)}`);
    if (!(typeof subvalidator === 'function' && subvalidator.length === 1)) throw new Error(`Invalid argument 'subvalidator': ${prettyPrint(subvalidator)}`);

    const typeName = typeof vtype === 'string' ? vtype : vtype._vtype;
    if (!(typeName in VType)) throw new Error(`Type '${typeName}' is not defined`);

    const typePrototype = typesPrototypes[typeName];
    if (subvalidatorName in typePrototype) throw new Error(`Subvalidator '${subvalidatorName}' already defined in type '${typeName}'`);

    typePrototype[subvalidatorName] = function () {
      let context = this;
      if (!hasOwnProperty.call(this, '_subvalidators')) {
        context = Object.create(this);
        context._subvalidators = [];
      }
      context._subvalidators.push(subvalidatorName);
      return context;
    };
    (subvalidators[typeName] || (subvalidators[typeName] = Object.create(null)))[subvalidatorName] = subvalidator;
  }

  return {
    VType,
    addType,
    addTypeAdvanced,
    addSubvalidator,
    getPureValidator,
  }
}

module.exports = new _module();
module.exports._module = _module;
