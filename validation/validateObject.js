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

  /**
   * Метод применяющий метод валидации для конкретного поля объекта.
   */
  function validateSpecificField(generalValidator, fieldContext, fieldName) {
    return function (objectValue, message, validationOptions) {
      return generalValidator((() => fieldContext), objectValue[fieldName], message, validationOptions);
    }
  }

  function validateSpecificSubfield(generalValidator, fieldContext, fieldName) {
    return function (context, objectValue, message, validationOptions) {
      return generalValidator((() => `${context()}.${fieldName}`), objectValue[fieldName], message, validationOptions);
    }
  }

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

    const validators = [];
    const copiers = [];
    const requiredFields = (_extends && _extends.requiredFields) ? _extends.requiredFields.slice() : [];
    const fields = Object.create(null);
    if (_extends) Object.assign(fields, _extends.fields);

    const validatorThis = {
      validateSubfields: _validateSubfields, // validateSubfields нужен для использование в реализации типа VType.Fields
      invalidFieldValue, // сообщение, о том что поле имеет неправильно значение - для использование в типах, определнных как функция

    };

    let fieldName;
    const context = () => fieldName;
    for (fieldName of Object.getOwnPropertyNames(schema)) {
      if (fieldName.startsWith('_')) {
        switch (fieldName) {
          case '_extends':
          case '_validate':
            continue;
          default:
            throw new Error(`Invalid property name: '${context()}'`);
        }
      }

      if (hasOwnProperties.call(fields, fieldName)) throw new Error(`Field '${context()}' is already defined in parent structure`);
      fields[fieldName] = true;

      const fieldDef = schema[fieldName];

      const generalValidator = _validateRequired.call(validatorThis, context, fieldDef);
      if (generalValidator) validators.push(validateSpecificField(generalValidator, context(), fieldName));

      if (fieldDef.required) requiredFields.push(missingField(context));

      if (copyFields && hasOwnProperties.call(fieldDef, 'copy')) {
        const copy = fieldDef.copy;
        if (typeof copy === 'function') {
          const generalCopier = copy.call(validatorThis, context, fieldDef, fieldName);
          const fieldContext = context();
          copiers.push((value, message, validateOptions) => generalCopier((() => fieldContext), value, message, validateOptions));
        } else if (typeof copy === 'boolean') {
          if (copy) {
            const destFieldName = `_${fieldName}`;
            const fieldToCopy = fieldName;
            copiers.push(function (value, message, validateOptions) {
              validateOptions.copyTo[destFieldName] = value[fieldToCopy];
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
      const parentValidate = (schema._extends.validate);
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
        for (fieldName of Object.getOwnPropertyNames(value)) // поиск полей, которые не ожидаются в событии
          if (!(fieldName in fields))
            (message || (message = [])).push(unexpectedField(context, value[fieldName]));
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

  function _validateSubfields(parentContext, fields) {

    const validators = [];
    const fieldsMap = Object.create(null);

    if (!(typeof fields === 'object' && fields != null && !Array.isArray(fields)))
      throw new Error(`Field '${parentContext()}': Invalid attribute 'fields' value: ${prettyPrint(fields)}`);

    let subfieldName;
    const context = () => `${parentContext()}.${subfieldName}`;
    for (subfieldName of Object.getOwnPropertyNames(fields)) {
      if (subfieldName.startsWith('_')) throw new Error(`Field '${parentContext()}': Invalid subfield name: '${subfieldName}'`);
      fieldsMap[subfieldName] = true;
      const fieldDef = fields[subfieldName];
      if (hasOwnProperties.call(fieldDef, 'copy')) throw new Error(`Field '${context()}': For any subfield it is not allowed to have a 'copy' attribute`);
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
        for (subfieldName of Object.getOwnPropertyNames(value))
          if (!(subfieldName in fieldsMap))
            (message || (message = [])).push(unexpectedField(context, value[subfieldName]));
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
   * Копирует значение поля, если в его описание указан признак copy и при выполнении в опциях есть поле copyTo.
   */
  // TODO: Перенести копирование в отдельную ветку
  // function _copyField(context, fieldDef) {
  //   const copy = fieldDef.copy;
  //   if (typeof copy === 'function') return copy.call(this, context, fieldDef);
  //   else if (typeof copy === 'boolean') {
  //     if (copy) {
  //       const destFieldName = `_${fieldName}`;
  //       return function (context, value, message, validateOptions) {
  //         validateOptions.copyTo[destFieldName] = value[fieldName];
  //       }
  //     }
  //   } else if (copy === undefined) return;
  //   throw new Error(`Field '${fieldName}' definition: Invalid attribute 'copy' value: ${prettyPrint(copy)}`);
  // }

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
            if (validateFunc(value, validateOptions)) return;
            (msg || (msg = [])).push(invalidFieldValue(context, value));
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
    if (!(type || fields)) throw new Error(`Field '${context()}' must have either 'type' and 'fields' attribute`);
    if (type && fields) throw new Error(`Field '${context()}' cannot have both 'type' and 'fields' attributes`);

    if (fields)
      return _validateSubfields.call(this, context, fields);
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
            msg = validate(context, value, message);
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
        throw new Error(`Unexpected type: '${type}'`);
    }
  }

  return validateObject;
}

export const messageMissingField = (context, value) => `Missing required field '${context()}'`;
export const messageUnexpectedField = (context, value) => `Unexpected field '${context()}' with value: ${prettyPrint(value)}`;
export const messageInvalidFieldValue = (context, value) => `Invalid field '${context()}' value: ${prettyPrint(value)}`;

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

export const validateArgumentNameOptions = {argument: 'options'}
