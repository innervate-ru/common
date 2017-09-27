import {missingArgument, invalidArgument} from './arguments'
import prettyPrint from '../utils/prettyPrint'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Общий код, который позволяет организовать проверку заполнености объектов, в нескольких сценариях:
 *
 * - проверка, что options передаваемые сервису содержат допустимые поля и значения, и не
 *   содержат значений которые не ожидаются.  В случае проблема
 *
 * - проверка, что сохраняемые событие содержат ожидаемые поля.  Если отсутствуют обязательные поля, поля имеют не ожидаемый
 *   тип, или присутствуют не ожидаемые поля, то пишется warn сообщение в консоль.
 *
 *  Так же есть возможность копировать часть свойств одного объекта в другой, чтобы не писать рутинный код в каждом конкретном случае.
 */
export function validateObjectFactory({
  missingField = missingArgument('missingField'),
  unexpectedField = null,
  invalidFieldValue = missingArgument('invalidFieldValue'),
  resultWrapper = null,
  copyFields = false,
  validateExtends = false,
  notPureData = false, // если true, то объект может как свойства содержать методы, что нормельно для объектов опций.  Например, компонента config возвращает структуру с методом get
  maxUnexpectedItems = 4, // максимальное количество сообщений о не ожиданных полях.  Уменьшает до разумного длину сообщения, если проверяется "левый" объект.  0 - выводить без ограничений
  maxInvalidArrayItems = 4, // максимальное количество сообщение об ошибках в элементах массива.  Последние выводится в ..., чтоб показать что проверка дальше не проводилась

}) {

  if (!(typeof missingField == 'function')) throw new Error(`Invalid argument 'missingField': ${prettyPrint(missingField)}`);
  if (!(unexpectedField === undefined || unexpectedField === null || typeof unexpectedField == 'function')) throw new Error(`Invalid argument 'unexpectedField': ${prettyPrint(unexpectedField)}`);
  if (!(typeof invalidFieldValue == 'function')) throw new Error(`Invalid argument 'invalidFieldValue': ${prettyPrint(invalidFieldValue)}`);
  if (!(resultWrapper === undefined || resultWrapper === null || typeof resultWrapper == 'function')) throw new Error(`Invalid argument 'resultWrapper: ${resultWrapper}'`);
  if (copyFields && validateExtends) throw new Error(`copyFields and validateExtends optioins are not working together`);

  /**
   * Метод применяющий метод валидации для конкретного поля объекта.
   */
  function validateSpecificField(generalValidator, fieldContext, fieldName) {
    return function (objectValue, message, validateOptions) {
      return generalValidator((() => fieldContext), objectValue[fieldName], message, validateOptions);
    }
  }

  function validateSpecificSubfield(generalValidator, fieldContext, fieldName) {
    return function (context, objectValue, message, validateOptions) {
      return generalValidator((() => `${context()}.${fieldName}`), objectValue[fieldName], message, validateOptions);
    }
  }

  function validateObject(schema = missingArgument('schema'), factoryOptions) {

    if (!(typeof schema === 'object' && schema !== null && !Array.isArray(schema)))
      throw new Error(`Invalid argument 'schema': ${prettyPrint(schema)}`);

    let _extends;
    if (hasOwnProperty.call(schema, '_extends')) {
      _extends = schema._extends;
      if (!((typeof _extends === 'function' && 'fields' in _extends)))
        throw new Error(`Invalid value of _extends: ${prettyPrint(_extends)}`);
    }

    let _validate;
    if (hasOwnProperty.call(schema, '_validate')) {
      _validate = schema._validate;
      if (!(_validate === undefined || _validate === null || typeof _validate === 'function'))
        throw new Error(`Invalid value of _validate: ${prettyPrint(_validate)}`);
    }

    if (!(factoryOptions === undefined || factoryOptions === null || (typeof factoryOptions == 'object' && !Array.isArray(factoryOptions))))
      throw new Error(`Invalid argument 'factoryOptions': ${prettyPrint(factoryOptions)}`);

    const validators = [];
    const copiers = [];
    const requiredFields = (_extends && _extends.requiredFields) ? _extends.requiredFields.slice() : [];
    const fields = Object.create(null);
    if (_extends) Object.assign(fields, _extends.fields);

    const validatorThis = {
      validateSubfields: _validateSubfields, // validateSubfields нужен для использование в реализации типа VType.Fields
      validateArray: _validateArray,
      validateNull: _validateNull, // validateSubfields нужен для использование в реализации типа VType.Array
      invalidFieldValue, // сообщение, о том что поле имеет неправильно значение - для использование в типах, определнных как функция

    };

    let fieldName;
    const context = () => fieldName;
    for (fieldName in schema) {
      if (!hasOwnProperty.call(schema, fieldName)) continue;
      if (fieldName.startsWith('_')) {
        switch (fieldName) {
          case '_extends':
          case '_validate':
            continue;
          default:
            throw new Error(`Invalid property name: '${context()}'`);
        }
      }

      if (hasOwnProperty.call(fields, fieldName)) throw new Error(`Field '${context()}' is already defined in parent structure`);
      fields[fieldName] = true;

      const fieldDef = schema[fieldName];

      const generalValidator = _validateRequired.call(validatorThis, context, fieldDef);
      if (generalValidator) validators.push(validateSpecificField(generalValidator, context(), fieldName));

      if (fieldDef.required) requiredFields.push(missingField(context));

      if (copyFields && hasOwnProperty.call(fieldDef, 'copy')) {
        const copy = fieldDef.copy;
        if (typeof copy === 'function') {
          const generalCopier = copy.call(validatorThis, context, fieldDef, fieldName);
          copiers.push((value, message, validateOptions) => generalCopier(context, value, message, validateOptions));
        } else if (typeof copy === 'boolean') {
          if (copy) {
            const destFieldName = `_${fieldName}`;
            const fieldToCopy = fieldName;
            if (hasOwnProperty.call(fieldDef, 'default')) {
              const defaultValue = fieldDef.default;
              const isWrong = generalValidator(context, defaultValue);
              if (isWrong) throw new Error(`Field '${context()}': Invalid value of 'default': ${prettyPrint(defaultValue)}`);
              copiers.push(function (value, message, validateOptions) {
                const v = value[fieldToCopy];
                validateOptions.copyTo[destFieldName] = v === undefined ? defaultValue : v;
              });
            }
            else
              copiers.push(function (value, message, validateOptions) {
                const v = value[fieldToCopy];
                if (v !== undefined) validateOptions.copyTo[destFieldName] = v;
              });
          }
        } else throw new Error(`Field '${context()}': Invalid attribute 'copy' value: ${prettyPrint(copy)}`);
      }
    }

    let validateFunc = function (value, validateOptions) { // метод, который выполняет проверку и доп. операции, как копирование
      let message;
      for (const validate of validators)
        message = validate(value, message, validateOptions) || message; // проверяем все проверки
      return message;
    };

    if (validateExtends && schema._extends) {
      const innerValidateFunc = validateFunc;
      const parentValidate = schema._extends.validate;
      validateFunc = function (value, validateOptions) { // прогоняем полную функцию проверки для родительской структуры, кроме её врапера - без выдачи результата наружу
        const message = parentValidate(value, validateOptions);
        return innerValidateFunc(value, message, validateOptions) || message;
      }
    }

    if (copiers.length > 0) {
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        let message = innerValidateFunc(value, validateOptions);
        for (const copyFunc of copiers)
          message = copyFunc(value, message, validateOptions) || message;
        return message;
      }
    }

    if (_validate) {
      const innerValidateFunc = validateFunc;
      const validate = _validate;
      validateFunc = function (value, validateOptions) {
        let message = innerValidateFunc(value, validateOptions);
        message = validate(context, value, message, validateOptions);
        return message;
      }
    }

    const validateFuncBeforeWrapper = validateFunc;

    if (unexpectedField) {
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        let message = innerValidateFunc(value, validateOptions);
        let fieldName;
        const context = () => fieldName;
        let count = 0;
        for (fieldName in value) { // поиск полей, которые не ожидаются в событии
          if (!hasOwnProperty.call(value, fieldName)) continue;
          if (!(fieldName in fields || (notPureData && typeof fields[fieldName] !== 'function'))) {
            (message || (message = [])).push(unexpectedField(context, value[fieldName]));
            if (++count === maxUnexpectedItems) break;
          }
        }
        return message;
      }
    }

    if (requiredFields.length > 0) {
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        // это специальный случай: выдаем сообщение что нет обязательных полей, когда на входе не объект, а null или undefined
        if (value === undefined || value === null) return requiredFields;
        return innerValidateFunc(value, validateOptions);
      }
    } else {
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        // тут сообщения нет, но и обрабатывать нечего - так что, считаем, что всё в порядке
        if (value === undefined || value === null) return;
        return innerValidateFunc(value, validateOptions);
      };
    }

    if (resultWrapper) validateFunc = resultWrapper(validateFunc, factoryOptions);

    if (copiers.length > 0) { // если есть копирование, то обязательно должна быть опция 'copyTo'
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        if (!validateOptions || !hasOwnProperty.call(validateOptions, 'copyTo'))
          throw new Error(`Missing option 'copyTo': ${prettyPrint(validateOptions)}`);
        const copyTo = validateOptions.copyTo;
        if (!(typeof copyTo === 'object' && copyTo !== null && !Array.isArray(copyTo)))
          throw new Error(`Invalid option 'copyTo': ${prettyPrint(copyTo)}`);
        return innerValidateFunc(value, validateOptions);
      }
    }

    { // базовая проверка входных аргументов - что они или отсутствют или структуры данных
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        if (validateOptions !== undefined && validateOptions !== null) {
          if (!(typeof validateOptions === 'object' && validateOptions !== null && !Array.isArray(validateOptions)))
            throw new Error(`Invalid argument 'validateOptions': ${prettyPrint(validateOptions)}`);
        }
        if (value !== undefined && value !== null) {
          if (!(typeof value === 'object' && value !== null && !Array.isArray(value)))
            throw new Error(`Invalid argument '${(validateOptions && validateOptions.argument) || 'value'}': ${prettyPrint(value)}`);
        }
        return innerValidateFunc(value, validateOptions);
      }
    }

    validateFunc.fields = fields; // ещё раз присваеваем fields, чтобы они были доступны на внешнем методе проверки
    if (validateExtends) {
      validateFunc.validate = validateFuncBeforeWrapper;
      validateFunc.requiredFields = requiredFields;
    }

    return validateFunc;
  }

  function _validateSubfields(parentContext, fields) {

    const validators = [];
    const fieldsMap = Object.create(null);

    if (!(typeof fields === 'object' && fields != null && !Array.isArray(fields)))
      throw new Error(`Field '${parentContext()}': Invalid attribute 'fields' value: ${prettyPrint(fields)}`);

    let subfieldName;
    const context = () => `${parentContext()}.${subfieldName}`;
    for (subfieldName in fields) {
      if (!hasOwnProperty.call(fields, subfieldName)) continue;
      if (subfieldName.startsWith('_')) throw new Error(`Field '${parentContext()}': Invalid subfield name: '${subfieldName}'`);
      fieldsMap[subfieldName] = true;
      const fieldDef = fields[subfieldName];
      if (hasOwnProperty.call(fieldDef, 'copy')) throw new Error(`Field '${context()}': For any subfield it is not allowed to have a 'copy' attribute`);
      const generalValidator = _validateRequired.call(this, context, fieldDef);
      if (generalValidator) validators.push(validateSpecificSubfield(generalValidator, context(), subfieldName));
    }

    let validateSubfields = function (context, value, message, validateOptions) { // метод, который выполняет проверку и доп. операции, как копирование
      for (const validate of validators)
        message = validate(context, value, message, validateOptions) || message; // проверяем все проверки
      return message;
    };

    if (unexpectedField) {
      const innerValidateSubfields = validateSubfields;
      validateSubfields = function (parentContext, value, message, validateOptions) { // если включена опция unexpectedField, то проверяем что нет полей не объявденных в схеме
        message = innerValidateSubfields(parentContext, value, message, validateOptions) || message;
        let subfieldName;
        const context = () => `${parentContext()}.${subfieldName}`;
        for (subfieldName in value) {
          if (!hasOwnProperty.call(value, subfieldName)) continue;
          if (!(subfieldName in fieldsMap))
            (message || (message = [])).push(unexpectedField(context, value[subfieldName]));
        }
        return message;
      }
    }

    return function (context, value, message, validateOptions) {
      if (typeof value === 'object' && value != null && !Array.isArray(value))
        return validateSubfields(context, value, message, validateOptions);
      (message || (message = [])).push(invalidFieldValue(context, value));
      return message;
    }
  }

  function _validateArray(context, itemType) {
    const elementValidator = _validateNull.call(this, (() => `${context()}:VType.Array(...)`), itemType);
    const isRequired = !!itemType.required;
    return function (context, value, message, validateOptions) {
      if (!Array.isArray(value)) {
        (message || (message = [])).push(invalidFieldValue(context, value));
        return message;
      }
      if (isRequired && value.length === 0) {
        (message || (message = [])).push(invalidFieldValue(context, value, 'array is empty'));
        return message;
      }
      let i;
      const itemContext = () => `${context()}[${i}]`;
      let count = 0;
      for (i = 0; i < value.length; i++) {
        const msg = elementValidator(itemContext, value[i], undefined, validateOptions);
        if (msg) {
          if (++count === maxInvalidArrayItems) {
            message.push('...');
            return message;
          }
          if (message) Array.prototype.push.apply(message, msg);
          else message = msg;
        }
      }
      return message;
    };
  }

  /**
   * Если свойство поля required равно true, то проверяет что поле присутствует в объекте.  Иначе возвращает ошибку.
   * Если свойство поля required равно false, то вызывает следуюший шаг проверки, если поле присутствует в объекте.
   */
  function _validateRequired(context, fieldDef) {
    const nextCheck = _validateNull.call(this, context, fieldDef);

    if (fieldDef.required) {

      const validateRequired = function (context, value, message, validateOptions) {
        // для удобства сбора структур c использованием {...(v ? {a: v} : undefined)}, считаем что если поле имеет значение undefined, то его нет
        if (value === undefined) {
          (message || (message = [])).push(missingField(context, value));
          return message;
        }
      };

      if (nextCheck)
        return function (context, value, message, validateOptions) {
          const msg = validateRequired(context, value, message, validateOptions);
          if (!msg) return nextCheck(context, value, message, validateOptions);
          return msg;
        };
      else return validateRequired;
    }
    else {
      if (nextCheck) {
        return function (context, value, message, validateOptions) {
          if (value !== undefined)
            return nextCheck(context, value, message, validateOptions);
        };
      }
    }
  }

  /**
   * Если свойтсво поля null равное true, проверяет если поле null, то дальнейшие проверки не проводятся.
   */
  function _validateNull(context, fieldDef) {
    const nextCheck = _validateValidate.call(this, context, fieldDef);
    if (fieldDef.null)
      return function (context, value, message, validateOptions) {
        if (value == null) return;
        return nextCheck(context, value, message, validateOptions);
      };
    return nextCheck;
  }

  /**
   * Проверяем что поле проходит успешно кастомную валидацию, которая задается как свойство validate в fieldDef.
   * validate это функция, которая получает два параметра value и message, и возвращает undefined если данные прошли
   * успешно валидацию, или массив message, в который добавлено сообщение об обнаруженной проблеме.
   */
  function _validateValidate(context, fieldDef) {
    const prevCheck = _validateEitherTypeOrFields.call(this, context, fieldDef);
    if (fieldDef.validate) {
      const validateFunc = fieldDef.validate;
      if (typeof validateFunc === 'function' && (validateFunc.length === 1 || validateFunc.length == 2)) { // метод должен быть виде v => ... или (v, validateOptions) => ...
        return function (context, value, message, validateOptions) {
          let msg = prevCheck(context, value, message, validateOptions);
          if (!msg) {
            const resOrReason = validateFunc(value, validateOptions);
            if (typeof resOrReason === 'string') {
              (msg || (msg = [])).push(invalidFieldValue(context, value, resOrReason));
            } else {
              if (resOrReason) return;
              (msg || (msg = [])).push(invalidFieldValue(context, value));
            }
          }
          return msg;
        }
      } else throw new Error(`Field ${context()}: Invalid value of 'validate' attribute: ${prettyPrint(validateFunc)}`)
    }
    return prevCheck;
  }

  /**
   * Если тип задан, как fields, то обрабытваем вложенные поля, иначе обрабатываем значение атрибута type.
   */
  function _validateEitherTypeOrFields(context, fieldDef) {
    const type = fieldDef.type;
    const fields = fieldDef.fields;
    const array = fieldDef.array;
    let cnt = 0;
    if (type) { ++cnt; }
    if (fields) { ++cnt; }
    if (array) { ++cnt; }

    if (cnt === 0) throw new Error(`Field '${context()}': Must have either 'type', 'fields' or 'array' attribute: ${prettyPrint(fieldDef)}`);
    if (cnt != 1) throw new Error(`Field '${context()}': Cannot have in the same time 'type', 'fields' and 'array' attributes: ${prettyPrint(fieldDef)}`);

    if (fields)
      return _validateSubfields.call(this, context, fields);
    else if (array)
      return _validateArray.call(this, context, array);
    else
      return _validateListOfTypes.call(this, context, fieldDef);
  }

  /**
   * Если тип поля задан как массив, то каждый элемент массива проверяется как возможный допустимый вариант типа.  Если один из
   * типов проходит проверку успешно, то возвращает undefined.  Иначе ошибка что не верный тип данных.
   */
  function _validateListOfTypes(context, fieldDef) {
    const type = fieldDef.type;
    if (Array.isArray(type)) { // список
      const validators = type.map((type, i) => _validateType.call(this, () => `${context()}.type[${i}]`, fieldDef, type));
      if (validators.length == 0 || validators.findIndex((v) => v === undefined) == -1) { // если есть тип без проверок, то тогда подходит любое значение
        if (validators.length === 1) return validators[0]; // только один тип в списке
        else return function (context, value, message, validateOptions) {
          let msg;
          for (const validate of validators) {
            msg = validate(context, value, undefined, validateOptions);
            if (msg === undefined) return; // одна из проверок прошла успешно
          }
          // как ошибку возвращаем результат посленего валидатора
          if (message) {
            Array.prototype.push.apply(message, msg);
            return message;
          }
          return msg;
        }
      }
    }
    return _validateType.call(this, context, fieldDef, type); // простой тип, не список
  }

  /**
   * Проверяет данные на основании типа поля.
   */
  function _validateType(context, fieldDef, type) {

    if (typeof type === 'object' && type != null && '_vtype' in type) return type._build().call(this, context, fieldDef);

    switch (type) {

      case 'any': return;

      case 'str':
      case 'string':
        return function (context, value, message, validateOptions) {
          if (!(typeof value === 'string')) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'int':
      case 'integer':
        return function (context, value, message, validateOptions) {
          if (!Number.isInteger(value)) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'float':
        return function (context, value, message, validateOptions) {
          if (!(typeof value == 'number')) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'bool':
      case 'boolean':
        return function (context, value, message, validateOptions) {
          if (!(typeof value === 'boolean')) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'object':
        return function (context, value, message, validateOptions) {
          if (!(typeof value === 'object' && !Array.isArray(value))) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'array':
        return function (context, value, message, validateOptions) {
          if (!Array.isArray(value)) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      case 'function':
        return function (context, value, message, validateOptions) {
          if (!(typeof value === 'function')) {
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };

      default:
        throw new Error(`Field '${context()}': Unexpected type: ${prettyPrint(type)}`);
    }
  }

  return validateObject;
}

export const messageMissingField = (context, value) => `Missing required field '${context()}'`;
export const messageUnexpectedField = (context, value) => `Unexpected field '${context()}' with value: ${prettyPrint(value)}`;
export const messageInvalidFieldValue = (context, value, reason) => `Invalid field '${context()}' value${reason ? ` (reason: ${reason})` : ''}: ${prettyPrint(value)}`;

/**
 * Проверка опций, например, конструктора.  Каждый уровень (см. _extends) опций проверяется отдельно.  В случае
 * ошибки, выбрасывается Exception с переченем ошибок найденных на данном уровне проверки. *
 */
export const validateAndCopyOptionsFactory = validateObjectFactory({
  missingField: messageMissingField,
  invalidFieldValue: messageInvalidFieldValue,
  copyFields: true,
  // notPureData: true,
  resultWrapper: (validateFunc) => {
    return function (value, validateOptions) {
      const message = validateFunc(value, validateOptions);
      if (message)
        throw new Error(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Invalid argument '${(validateOptions && validateOptions.argument) || 'value'}': ${message.join('; ')}`);
    }
  },
});

/**
 * Проверка опций, например, конструктора.  Каждый уровень (см. _extends) опций проверяется отдельно.  В случае
 * ошибки, выбрасывается Exception с переченем ошибок найденных на данном уровне проверки. *
 */
export const validateFullAndCopyOptionsFactory = validateObjectFactory({
  missingField: messageMissingField,
  unexpectedField: messageUnexpectedField, // выдаем сообщения о полях, которые не ожидаем
  invalidFieldValue: messageInvalidFieldValue,
  copyFields: true,
  // notPureData: true,
  resultWrapper: (validateFunc) => {
    return function (value, validateOptions) {
      const message = validateFunc(value, validateOptions);
      if (message)
        throw new Error(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Invalid argument '${(validateOptions && validateOptions.argument) || 'value'}': ${message.join('; ')}`);
    }
  },
});

/**
 * Вариант проверки опций, без копирования.
 */
export const validateOptionsFactory = validateObjectFactory({
  missingField: messageMissingField,
  invalidFieldValue: messageInvalidFieldValue,
  // notPureData: true,
  resultWrapper: (validateFunc) => function (value, validateOptions) {
    const message = validateFunc(value, validateOptions);
    if (message)
      throw new Error(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Invalid argument '${(validateOptions && validateOptions.argument) || 'value'}': ${message.join('; ')}`);
  },
});

/**
 * Вариант проверки опций, без копирования и без возможности передачи лишних
 */
export const validateFullOptionsFactory = validateObjectFactory({
  missingField: messageMissingField,
  unexpectedField: messageUnexpectedField, // выдаем сообщения о полях, которые не ожидаем
  invalidFieldValue: messageInvalidFieldValue,
  // notPureData: true,
  resultWrapper: (validateFunc) => function (value, validateOptions) {
    const message = validateFunc(value, validateOptions);
    if (message)
      throw new Error(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Invalid argument '${(validateOptions && validateOptions.argument) || 'value'}': ${message.join('; ')}`);
  },
});

/**
 * Проверка объектов событий.  При обнаружении ошибки пишется в console.warn.  Проверяются сразу все уровни, если есть _extends.
 */
export const validateEventFactory = validateObjectFactory({
  missingField: messageMissingField,
  unexpectedField: messageUnexpectedField,
  invalidFieldValue: messageInvalidFieldValue,
  validateExtends: true,
  resultWrapper: (validateFunc, factoryOptions) => {

    const fields = validateFunc.fields;

    if (factoryOptions && factoryOptions.throwException)
      return function (value, validateOptions) {
        let message = validateFunc(value, validateOptions);
        if (message) throw new Error(`Event ${prettyPrint(value)}: ${message.join('; ')}`);
        return message;
      };
    else return function (value, validateOptions) {
      let message = validateFunc(value, validateOptions);
      if (message)
        ((validateOptions && validateOptions.console) || console)
          .warn(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Event ${prettyPrint(value)}: ${message.join('; ')}`);
      return message;
    };
  },
});

/**
 * Проверка объектов событий.  При обнаружении ошибки пишется в console.warn.  Проверяются сразу все уровни, если есть _extends.
 */
export const validateStructureFactory = validateObjectFactory({
  missingField: messageMissingField,
  unexpectedField: messageUnexpectedField,
  invalidFieldValue: messageInvalidFieldValue,
  validateExtends: true,
  resultWrapper: (validateFunc, factoryOptions) => {

    const fields = validateFunc.fields;

    if (factoryOptions && factoryOptions.throwException)
      return function (value, validateOptions) {
        let message = validateFunc(value, validateOptions);
        if (message) throw new Error(`Structure ${prettyPrint(value)}: ${message.join('; ')}`);
        return message;
      };
    else return function (value, validateOptions) {
      let message = validateFunc(value, validateOptions);
      if (message)
        ((validateOptions && validateOptions.console) || console)
          .warn(`${validateOptions && validateOptions.name ? `${validateOptions.name}: ` : ``}Structure ${prettyPrint(value)}: ${message.join('; ')}`);
      return message;
    };
  },
});

/**
 * Helper для создания метода проверки опций конструктора класса.  Этот вариант (см. ThisClass в названии) проверяет только
 * опции добавленные в этом классе, и не проверяет опции класса предка и не сообщает если есть опции про которые он не
 * знает - они могут быть опциями класса наследника
 */
export const validateThisClassCtorOptions = function (schema = missingArgument('schema')) {
  const validate = validateAndCopyOptionsFactory(schema);
  const res = function (obj, options) { return validate(options, {argument: 'options', copyTo: obj}); };
  Object.setPrototypeOf(res, validate); // чтобы были доступны данные схемы, необходимые для _extends
  return res;
};

/**
 * Helper для создания метода проверки опций конструктора класса.  Этот вариант (см. FinishedClass в названии) проверяет только опции
 * добавленные в этом классе, но в отличии от validateThisClassCtorOptions, так же проверят что опции содержат не ожидаемые поля для
 * этого класса и классов предков.  Поэтому, этот метод можно использовать только в конструкторая классов, от которые не будет выполняться
 * наследование.
 */
export const validateFinishedClassCtorOptions = function (schema = missingArgument('schema')){
  const validate = validateFullAndCopyOptionsFactory(schema);
  const res = function (obj, options) {
    if (!(arguments.length === 2))  throw new Error(`Invalid number of arguments: Must be two: 1. this; 2. options)`);
    validate(options, {argument: 'options', copyTo: obj});
  }
  Object.setPrototypeOf(res, validate); // чтобы были доступны данные схемы, необходимые для _extends
  return res;
};

// TODO: Прокоменировать методы ниже, когда заработают

export const validateThisClassMethodArgsBuilder = function (schema = missingArgument('schema')) {
  const validate = validateOptionsFactory(schema);
  const res = function (argumentName = missingArgument('argumentName')) {
    if (!(typeof argumentName === 'string' && argumentName.length > 0)) invalidArgument('argumentName');
    const options = {argument: argumentName};
    const res2 = function (value) { validate(value, options); }
    Object.setPrototypeOf(res2, validate); // чтобы были доступны данные схемы, необходимые для _extends
    return res2;
  };
  Object.setPrototypeOf(res, validate); // чтобы были доступны данные схемы, необходимые для _extends
  return res;
};

export const validateThisClassMethodArgs = function (argumentName = missingArgument('argumentName'), schema = missingArgument('schema')) {
  return validateThisClassMethodArgsBuilder(schema)(argumentName);
};

export const validateFinishedMethodArgsBuilder = function (schema = missingArgument('schema')) {
  const validate = validateFullOptionsFactory(schema);
  const res = function (argumentName = missingArgument('argumentName')) {
    if (!(typeof argumentName === 'string' && argumentName.length > 0)) invalidArgument('argumentName');
    const options = {argument: argumentName};
    const res2 = function (value) { validate(value, options); };
    Object.setPrototypeOf(res2, validate); // чтобы были доступны данные схемы, необходимые для _extends
    return res2;
  };
  Object.setPrototypeOf(res, validate); // чтобы были доступны данные схемы, необходимые для _extends
  return res;
};

export const validateFinishedMethodArgs = function (argumentName = missingArgument('argumentName'), schema = missingArgument('schema')) {
  return validateThisClassMethodArgsBuilder(schema)(argumentName);
};

/**
 * Структура облегчающая по средствам IDE IntelliJ IDEA написание, и чтение разных валидаторов.
 */
export const validate = {
  ctor: {
    this: validateThisClassCtorOptions,
    finished: validateFinishedClassCtorOptions,
  },
  method: {
    this: validateThisClassMethodArgs,
    finished: validateFinishedMethodArgs,
  },
  builder: {
    method: {
      this: validateThisClassMethodArgsBuilder,
      finished: validateFinishedMethodArgsBuilder,
    }
  },
};
