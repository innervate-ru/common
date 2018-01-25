const validatorsMap = Object.create(null);

/**
 * Метод применяющий метод валидации для конкретного поля объекта.
 */
function _validateSpecificField(generalValidator, fieldContext, fieldName) {
  return function (objectValue, message, validateOptions) {
    return generalValidator(fieldContext, objectValue[fieldName], message, validateOptions);
  }
}

function buildValidateFields(parentContext, fields) {

  const validators = [];
  const fieldsMap = Object.create(null);

  if (!(typeof fields === 'object' && fields != null && !Array.isArray(fields)))
    throw new Error(`Field '${parentContext()}': Invalid attribute 'fields' value: ${prettyPrint(fields)}`);

  let _final = false;

  let subfieldName;
  const fieldContext = parentContext ? (() =>  `${parentContext()}.${subfieldName}`) : () => subfieldName;
  for (subfieldName in fields) {
    if (!hasOwnProperty.call(fields, subfieldName)) continue;
    if (subfieldName === '_final') {
      _final = fields[subfieldName];
      if (!(typeof _final === 'boolean')) throw new Error(`Field '${parentContext()}': Invalid value of attribute '_final': ${prettyPrint(_final)}`);
      continue;
    }
    if (subfieldName.startsWith('_')) throw new Error(`Field '${parentContext()}': Invalid subfield name: '${subfieldName}'`);
    fieldsMap[subfieldName] = true;
    const fieldDef = fields[subfieldName];
    if (hasOwnProperty.call(fieldDef, 'copy')) throw new Error(`Field '${fieldContext()}': For any subfield it is not allowed to have a 'copy' attribute`);
    const generalValidator = _validateRequired.call(this, fieldContext, fieldDef);
    if (generalValidator) validators.push(_validateSpecificField(generalValidator, fieldContext(), subfieldName));
  }

  let validateSubfields = function (fieldContext, value, message, validateOptions) { // метод, который выполняет проверку и доп. операции, как копирование
    for (const validate of validators)
      message = validate(fieldContext, value, message, validateOptions) || message; // проверяем все проверки
    return message;
  };

  if (_final) {
    const innerValidateSubfields = validateSubfields;
    validateSubfields = function (parentContext, value, message, validateOptions) { // если включена опция validateOptions.unexpectedField, то проверяем что нет полей не объявденных в схеме
      message = innerValidateSubfields(parentContext, value, message, validateOptions) || message;
      let subfieldName;
      const fieldContext = parentContext ? (() =>  `${parentContext()}.${subfieldName}`) : () => subfieldName;
      for (subfieldName in value) {
        if (!hasOwnProperty.call(value, subfieldName)) continue;
        if (!(subfieldName in fieldsMap))
          (message || (message = [])).push(validateOptions.unexpectedField(fieldContext, value[subfieldName]));
      }
      return message;
    }
  }

  return function (context, value, message, validateOptions) {
    if (typeof value === 'object' && value != null && !Array.isArray(value))
      return validateSubfields(context, value, message, validateOptions);
    (message || (message = [])).push(validateOptions.invalidFieldValue(context, value));
    return message;
  }
}

function buildValidateArray(context, itemType) {
  const elementValidator = _validateNull.call(this, (() => `${context()}:VType.Array(...)`), itemType);
  const isRequired = !!itemType.required;
  return function (context, value, message, validateOptions) {
    if (!Array.isArray(value)) {
      (message || (message = [])).push(validateOptions.invalidFieldValue(context, value));
      return message;
    }
    if (isRequired && value.length === 0) {
      (message || (message = [])).push(validateOptions.invalidFieldValue(context, value, 'array is empty'));
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

// TODO: Impl buildValidateMap

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
        (message || (message = [])).push(validateOptions.missingField(context, value));
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
            (msg || (msg = [])).push(validateOptions.invalidFieldValue(context, value, resOrReason));
          } else {
            if (resOrReason) return;
            (msg || (msg = [])).push(validateOptions.invalidFieldValue(context, value));
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
    return buildValidateFields.call(this, context, fields);
  else if (array)
    return buildValidateArray.call(this, context, array);
  else
    return _validateListOfTypes.call(this, context, fieldDef);
}

/**
 * Если тип поля задан как список типов, то каждый элемент массива проверяется как возможный допустимый вариант типа.  Если один из
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

  if (!(typeof type === 'object' && type != null && '_vtype' in type)) {

    switch (type) {

      case 'any': type = VType.Any(); break;

      case 'str': case 'string': type = VType.String(); break;

      case 'int': case 'integer': type = VType.Int(); break;

      case 'float': type = VType.Float(); break;

      case 'bool': case 'boolean': type = VType.Boolean(); break;

      case 'object': type = VType.Object(); break;

      case 'array': type = VType.Array(); break;

      case 'function': type = VType.Function(); break;

      default: throw new Error(`Field '${context()}': Unexpected type: ${prettyPrint(type)}`);
    }
  }

  const key = `VType.${type._vtype}`;
  return validatorsMap[key] || (validatorsMap[key] = type._build().call(this, context, fieldDef));
}
