import throwIfMissing from 'throw-if-missing'
import prettyPrint from '../utils/prettyPrint'

const hasOwnProperties = Object.prototype.hasOwnProperty;

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
  missingField = throwIfMissing('missingField'),
  unexpectedField = null,
  invalidFieldValue = throwIfMissing('invalidFieldValue'),
  resultWrapper = null,
  copyFields = false,
  validateExtends = false,
}) {

  if (!(typeof missingField == 'function')) throw new Error(`Invalid argument 'missingField': ${prettyPrint(missingField)}`);
  if (!(unexpectedField === undefined || unexpectedField === null || typeof unexpectedField == 'function')) throw new Error(`Invalid argument 'unexpectedField': ${prettyPrint(unexpectedField)}`);
  if (!(typeof invalidFieldValue == 'function')) throw new Error(`Invalid argument 'invalidFieldValue': ${prettyPrint(invalidFieldValue)}`);
  if (!(resultWrapper === undefined || resultWrapper === null || typeof resultWrapper == 'function')) throw new Error(`Invalid argument 'resultWrapper: ${resultWrapper}'`);
  if (copyFields && validateExtends) throw new Error(`copyFields and validateExtends optioins are not working together`);

  function validateObject(schema = throwIfMissing('schema'), factoryOptions) {

    if (!(typeof schema === 'object' && schema !== null && !Array.isArray(schema)))
      throw new Error(`Invalid argument 'schema': ${schema}`);

    let _extends;
    if (hasOwnProperties.call(schema, '_extends')) {
      _extends = schema._extends;
      if (!((typeof _extends === 'function' && hasOwnProperties.call(_extends, 'fields'))))
        throw new Error(`Invalid value of _extends: ${prettyPrint(_extends)}`);
    }

    let _validate;
    if (hasOwnProperties.call(schema, '_validate')) {
      _validate = schema._validate;
      if (!(_validate === undefined || _validate === null || typeof _validate === 'function'))
        throw new Error(`Invalid value of _validate: ${prettyPrint(_validate)}`);
    }

    if (!(factoryOptions === undefined || factoryOptions === null || (typeof factoryOptions == 'object' && !Array.isArray(factoryOptions))))
      throw new Error(`Invalid argument 'factoryOptions': ${prettyPrint(factoryOptions)}`);

    const validates = [];
    const requiredFields = (_extends && _extends.requiredFields) ? _extends.requiredFields.slice() : [];
    const fields = Object.create(null);
    if (_extends) Object.assign(fields, _extends.fields);

    const context = {
      anyCopyFunc: false,
      validateSubfields: _validateSubfields, // validateSubfields нужен для использование в реализации типа VType.Fields
      invalidFieldValue, // сообщение, о том что поле имеет неправильно значение - для использование в типах, определнных как функция
    };
    for (const fieldName of Object.getOwnPropertyNames(schema)) {
      if (fieldName.startsWith('_')) {
        switch (fieldName) {
          case '_extends':
          case '_validate':
            continue;
          default:
            throw new Error(`Invalid property name: '${fieldName}'`);
        }
      }
      if (hasOwnProperties.call(fields, fieldName)) throw new Error(`Field '${fieldName}' is already defined in parent structure`);
      fields[fieldName] = true;
      const fieldDef = schema[fieldName];
      const validate = _validateRequired.call(context, undefined, fieldName, fieldDef);
      if (fieldDef.required) requiredFields.push(missingField(undefined, undefined, fieldName));
      if (validate) validates.push(validate);
    }

    let validateFunc = function (value, validateOptions) { // метод, который выполняет проверку и доп. операции, как копирование
      let message;
      for (const validate of validates)
        message = validate(value, message, validateOptions) || message; // проверяем все проверки
      return message;
    };

    if (validateExtends && schema._extends) {
      const innerValidateFunc = validateFunc;
      const parentValidate = (schema._extends.validate);
      validateFunc = function (value, message, validateOptions) { // прогоняем полную функцию проверки для родительской структуры, кроме её врапера - без выдачи результата наружу
        const msg = parentValidate(value, message, validateOptions);
        return innerValidateFunc(value, msg || message, validateOptions) || msg;
      }
    }

    if (_validate) {
      const innerValidateFunc = validateFunc;
      const validate = _validate;
      validateFunc = function (value, validateOptions) {
        let message = innerValidateFunc(value, validateOptions);
        message = validate(value, message, validateOptions);
        return message;
      }
    }

    const validateFuncBeforeWrapper = validateFunc;

    if (unexpectedField) {
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        let message = innerValidateFunc(value, validateOptions);
        for (const fieldName of Object.getOwnPropertyNames(value)) // поиск полей, которые не ожидаются в событии
          if (!(fieldName in fields))
            (message || (message = [])).push(unexpectedField(value, undefined, fieldName));
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

    if (context.anyCopyFunc) { // если есть копирование, то обязательно должна быть опция 'copyTo'
      const innerValidateFunc = validateFunc;
      validateFunc = function (value, validateOptions) {
        if (!validateOptions || !hasOwnProperties.call(validateOptions, 'copyTo'))
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

  function _validateSubfields(thisFieldNamePrefix, thisFieldName, fields) {

    const validates = [];
    const fieldsMap = Object.create(null);

    if (!(typeof fields === 'object' && fields != null && !Array.isArray(fields)))
      throw new Error(`Field '${thisFieldName}': Invalid attribute 'fields' value: ${prettyPrint(fields)}`);

    const fieldNamePrefix = thisFieldNamePrefix ? `${thisFieldNamePrefix}.${thisFieldName}` : thisFieldName;

    for (const subfieldName of Object.getOwnPropertyNames(fields)) {
      const fieldName = `${thisFieldName}.${subfieldName}`;
      if (subfieldName.startsWith('_')) throw new Error(`Invalid property name: '${fieldName}'`);
      fieldsMap[subfieldName] = true;
      const fieldDef = fields[subfieldName];
      if (hasOwnProperties.call(fieldDef, 'copy')) throw new Error(`Field '${fieldName}': For any subfield it is not allowed to have a 'copy' attribute`);
      const validate = _validateRequired.call(this, fieldNamePrefix, subfieldName, fieldDef);
      if (validate) validates.push(validate);
    }

    let validateSubfields = function (value, message, validateOptions) { // метод, который выполняет проверку и доп. операции, как копирование
      for (const validate of validates)
        message = validate(value, message, validateOptions) || message; // проверяем все проверки
      return message;
    };

    if (unexpectedField) {
      const innerValidateSubfields = validateSubfields;
      validateSubfields = function (value, message, validateOptions) { // если включена опция unexpectedField, то проверяем что нет полей не объявденных в схеме
        message = innerValidateSubfields(value, message, validateOptions) || message;
        for (const subfieldName of Object.getOwnPropertyNames(value))
          if (!(subfieldName in fieldsMap))
            (message || (message = [])).push(unexpectedField(value, fieldNamePrefix, subfieldName));
        return message;
      }
    }

    return function (value, message, validateOptions) {
      const subfieldValue = value[thisFieldName];
      if (subfieldValue === undefined || subfieldValue === null) return; // проверяем что значение не null или undefined, что означает, что значения нет
      if (typeof subfieldValue === 'object' && !Array.isArray(subfieldValue))
        return validateSubfields(subfieldValue, message, validateOptions);
      (message || (message = [])).push(invalidFieldValue(thisValue, thisFieldNamePrefix, thisFieldName));
      return message;
    }
  }

  /**
   * Если свойство поля required равно true, то проверяет что поле присутствует в объекте.  Иначе возвращает ошибку.
   * Если свойство поля required равно false, то вызывает следуюший шаг проверки, если поле присутствует в объекте.
   */
  function _validateRequired(fieldNamePrefix, fieldName, fieldDef) {
    const pureNextCheck = _validateNull.call(this, fieldNamePrefix, fieldName, fieldDef);
    const copyFunc = copyFields ? _copyField.call(this, fieldNamePrefix, fieldName, fieldDef) : undefined;

    this.anyCopyFunc = this.anyCopyFunc || !!copyFunc;

    const nextCheck = pureNextCheck ? (copyFunc ? function (value, message, validateOptions) { // объединяем nextCheck и copyFunc в одину функцию
      message = pureNextCheck(value, message, validateOptions);
      if (!message) message = copyFunc(value, message, validateOptions);
      return message
    } : pureNextCheck) : copyFunc;

    if (fieldDef.required) {

      const validateRequired = function (value, message, validateOptions) {
        if (!hasOwnProperties.call(value, fieldName)) {
          (message || (message = [])).push(missingField(value, fieldNamePrefix, fieldName));
          return message;
        }
      };

      if (nextCheck)
        return function (value, message, validateOptions) {
          const msg = validateRequired(value, message, validateOptions);
          if (!msg) return nextCheck(value, message, validateOptions);
          return msg;
        };
      else return validateRequired;
    }
    else {
      if (nextCheck) {
        return function (value, message, validateOptions) {
          if (hasOwnProperties.call(value, fieldName))
            return nextCheck(value, message, validateOptions);
        };
      }
    }
  }

  /**
   * Копирует значение поля, если в его описание указан признак copy и при выполнении в опциях есть поле copyTo.
   */
  function _copyField(fieldNamePrefix, fieldName, fieldDef) {
    const copy = fieldDef.copy;
    if (typeof copy === 'function') return copy.call(this, fieldNamePrefix, fieldName, fieldDef);
    else if (typeof copy === 'boolean') {
      if (copy) {
        const destFieldName = `_${fieldName}`;
        return function (value, message, validateOptions) {
          validateOptions.copyTo[destFieldName] = value[fieldName];
        }
      }
    } else if (copy === undefined) return;
    throw new Error(`Field '${fieldName}' definition: Invalid attribute 'copy' value: ${prettyPrint(copy)}`);
  }

  /**
   * Если свойтсво поля null равное true, проверяет если поле null, то дальнейшие проверки не проводятся.
   */
  function _validateNull(fieldNamePrefix, fieldName, fieldDef) {
    const nextCheck = _validateValidate.call(this, fieldNamePrefix, fieldName, fieldDef);
    if (fieldDef.null)
      return function (value, message, validateOptions) {
        if (value[fieldName] == null) return;
        return nextCheck(value, message, validateOptions);
      };
    return nextCheck;
  }

  /**
   * Проверяем что поле проходит успешно кастомную валидацию, которая задается как свойство validate в fieldDef.
   * validate это функция, которая получает два параметра value и message, и возвращает undefined если данные прошли
   * успешно валидацию, или массив message, в который добавлено сообщение об обнаруженной проблеме.
   */
  function _validateValidate(fieldNamePrefix, fieldName, fieldDef) {
    const nextCheck = _validateEitherTypeOrFields.call(this, fieldNamePrefix, fieldName, fieldDef);
    if (fieldDef.validate) {
      const validateFunc = fieldDef.validate;
      if (typeof validateFunc === 'function' && (validateFunc.length === 1 || validateFunc.length == 2)) { // метод должен быть виде v => ... или (v, validateOptions) => ...
        return function (value, message, validateOptions) {
          let msg = nextCheck(value, message, validateOptions);
          if (!msg) {
            if (validateFunc(value[fieldName], validateOptions)) return;
            (msg || (msg = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
          }
          return msg;
        }
      } else throw new Error(`Field ${fieldName}: Invalid value of 'validate' attribute: ${prettyPrint(validateFunc  )}`)
    }
    return nextCheck;
  }

  /**
   * Если тип задан, как fields, то обрабытваем вложенные поля, иначе обрабатываем значение атрибута type.
   */
  function _validateEitherTypeOrFields(fieldNamePrefix, fieldName, fieldDef) {
    const type = fieldDef.type;
    const fields = fieldDef.fields;
    if (!(type || fields)) throw new Error(`Field '${fieldName}' must have either 'type' and 'fields' attribute`);
    if (type && fields) throw new Error(`Field '${fieldName}' cannot have both 'type' and 'fields' attributes`);

    if (fields)
      return _validateSubfields.call(this, fieldNamePrefix, fieldName, fields);
    else
      return _validateListOfTypes.call(this, fieldNamePrefix, fieldName, fieldDef);
  }

  /**
   * Если тип поля задан как массив, то каждый элемент массива проверяется как возможный допустимый вариант типа.  Если один из
   * типов проходит проверку успешно, то возвращает undefined.  Иначе ошибка что не верный тип данных.
   */
  function _validateListOfTypes(fieldNamePrefix, fieldName, fieldDef) {
    const type = fieldDef.type;
    if (Array.isArray(type)) { // список
      const validates = type.map((t) => _validateType.call(this, fieldNamePrefix, fieldName, fieldDef, t));
      if (validates.length == 0 || validates.findIndex((v) => v === undefined) == -1) { // если есть тип без проверок, то тогда подходит любое значение
        if (validates.length === 1) return validates[0]; // только один тип в списке
        else return function (value, message, validateOptions) {
          let msg;
          for (const validate of validates)
            if (validate(value, msg) === undefined) return; // одна из проверок прошла успешно
          (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
          return message;
        }
      }
    }

    return _validateType.call(this, fieldNamePrefix, fieldName, fieldDef, type); // простой тип, не список
  }

  /**
   * Проверяет данные на основании типа поля.
   */
  function _validateType(fieldNamePrefix, fieldName, fieldDef, type) {

    if (typeof type == 'function') return type.call(this, fieldNamePrefix, fieldName, fieldDef); // тип - функция

    switch (type) {
      case 'str':
      case 'string':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!(typeof v === 'string')) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'int':
      case 'integer':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!Number.isInteger(v)) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'float':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!(typeof v == 'number')) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'bool':
      case 'boolean':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!(typeof v === 'boolean')) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'object':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!(typeof v === 'object' && !Array.isArray(v))) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'array':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!Array.isArray(v)) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      case 'function':
        return function (value, message, validateOptions) {
          const v = value[fieldName];
          if (!(typeof v === 'function')) {
            (message || (message = [])).push(invalidFieldValue(value, fieldNamePrefix, fieldName));
            return message;
          }
        };

      default:
        throw new Error(`Unexpected type: '${type}'`);
    }
  }

  return validateObject;
}

export const messageMissingField = (value, fieldNamePrefix, fieldName) => `Missing required field '${fieldNamePrefix ? `${fieldNamePrefix}.${fieldName}` : fieldName}'`;
export const messageUnexpectedField = (value, fieldNamePrefix, fieldName) => `Unexpected field '${fieldNamePrefix ? `${fieldNamePrefix}.${fieldName}` : fieldName}': ${prettyPrint(value[fieldName])}`;
export const messageInvalidFieldValue = (value, fieldNamePrefix, fieldName) => `Invalid field '${fieldNamePrefix ? `${fieldNamePrefix}.${fieldName}` : fieldName}' value: ${prettyPrint(value[fieldName])}`;

/**
 * Проверка опций, например, конструктора.  Каждый уровень (см. _extends) опций проверяется отдельно.  В случае
 * ошибки, выбрасывается Exception с переченем ошибок найденных на данном уровне проверки. *
 */
export const validateAndCopyOptionsFactory = validateObjectFactory({
  missingField: messageMissingField,
  invalidFieldValue: messageInvalidFieldValue,
  copyFields: true,
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
  copyFields: false,
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

export const validateArgumentOptions = {argument: 'options'}
