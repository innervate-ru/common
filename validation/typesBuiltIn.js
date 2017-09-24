import {invalidArgument} from './arguments'

export default function (typesExport) {

  const {VType, addType, addSubvalidator, addTypeAdvanced} = typesExport;

  // типы Undefined и Null нужны, чтобы их можно включать в список типов в параметре types - особенно полезно для validateParameter, где параметр только список типов
  addType('Undefined', v => v === undefined);
  addType('Null', v => v === null);

  addType('String', v => typeof v === 'string');
  addType('Int', v => Number.isInteger(v));
  addType('Float', v => typeof v == 'number' && !isNaN(v));
  addType('Boolean', v => typeof v == 'boolean');
  addType('Object', v => typeof v === 'object' && !Array.isArray(v));
  addType('Function', v => typeof v === 'function');
  addType('Promise', v => v => typeof v === 'object' && v != null && 'then' in v);

  addTypeAdvanced('Fields', function (typeContextPrototype) {

    return function (fields) { // если fields не правильное значение,  то при построении вложенного валидатора будет ошибка

      const typeBuilder = Object.create(null); // null - так как не планируется что у Fields могут быть сабвалидаторы
      typeBuilder._vtype = 'Fields';
      typeBuilder._build = function () {
        return function (context, fieldDef) {
          return this.validateSubfields(context, fields);
        }
      };
      return typeBuilder;
    }
  });

  addTypeAdvanced('Array', function (typeContextPrototype) {

    const anArrayValidator = function (context, fieldDef) {
      const invalidFieldValue = this.invalidFieldValue;
      return function (context, value, message, validateOptions) {
        if (Array.isArray(value)) return;
        (message || (message = [])).push(invalidFieldValue(context, value));
        return message;
      }
    };

    const generalArrayTypeBuilder = Object.create(typeContextPrototype);
    generalArrayTypeBuilder._vtype = 'Array';
    generalArrayTypeBuilder._build = function () {
      return typeContextPrototype._build.call(this, anArrayValidator);
    };

    return function (itemType) { // если itemType не правильное значение,  то при построении вложенного валидатора будет ошибка
      if (itemType === undefined) return generalArrayTypeBuilder;
      else {
        const itemTypedArrayBuilder = Object.create(typeContextPrototype);
        itemTypedArrayBuilder._vtype = 'Array';
        itemTypedArrayBuilder._build = function () {
          return typeContextPrototype._build.call(this,
            function (context, fieldDef) {
              return this.validateArray(context, itemType);
            }
          );
        };
        return itemTypedArrayBuilder;
      }
    };
  });

  addSubvalidator(VType.String(), 'notEmpty', v => v.length > 0 ? true : 'empty string');
  addSubvalidator(VType.String(), 'noSpaces', v => /^\S*$/.test(v) ? true : 'contains spaces');

  addSubvalidator(VType.Int(), 'zero', v => v === 0 ? true : 'not zero');
  addSubvalidator(VType.Int(), 'positive', v => v > 0 ? true : 'not positive');
  addSubvalidator(VType.Int(), 'negative', v => v < 0 ? true : 'not negative');

  addSubvalidator(VType.Float(), 'zero', v => v === 0 ? true : 'not zero');
  addSubvalidator(VType.Float(), 'positive', v => v > 0 ? true : 'not positive');
  addSubvalidator(VType.Float(), 'negative', v => v < 0 ? true : 'not negative');

  addSubvalidator(VType.Array(), 'notEmpty', (v) => v.length > 0 ? true : `array is empty`);
  addSubvalidator(VType.Array(), 'onlyStrings', v => v.every(t => typeof t === 'string') ? true : 'not all strings');
  addSubvalidator(VType.Array(), 'notEmptyAndOnlyStrings', v => v.length === 0 ? `array is empty` : v.every(t => typeof t === 'string') ? true : 'not all strings');
}
