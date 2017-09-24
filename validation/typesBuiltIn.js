import {missingArgument, invalidArgument} from './arguments'

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

      const typeBuilder = Object.create(typeContextPrototype); // null - так как не планируется что у Fields могут быть сабвалидаторы
      typeBuilder._vtype = 'Fields';
      typeBuilder._build = function () {
        return typeContextPrototype._build.call(this,
          function (context, fieldDef) {
            return this.validateSubfields(context, fields);
          }
        );
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

  addTypeAdvanced('Recurrent', function (typeContextPrototype) {
    const recurrentTypeBuilder = Object.create(null); // не поддерживает subvalidator'ы - не понятно, что именно и когда дополнительно проверять
    recurrentTypeBuilder._vtype = 'Recurrent';
    recurrentTypeBuilder._build = function () {
      return typeContextPrototype._build.call(this,
        function (context, fieldDef) {
          let validator; // валидатор, который возвращает тип из VType.Recurrent(type => <тип>)
          const innerBuilder = Object.create(null); // вложенный тип, не поддерживает subvalidator'ы - пока нет идей зачем это может быть надо
          recurrentTypeBuilder._vtype = 'RecurrentInner';
          recurrentTypeBuilder._build = function () {
            return function (context, fieldDef) {
              return function (context, value, message, validateOptions) { // этот метод нужен чтоб при определении типа, сказать что проверка будет
                return validator(context, value, message, validateOptions); // хотя в момент сборки метода валидации переменная validate еще undefined, и будет заполнена позже
              };
            }
          };
          return function (typeDef = missingArgument('typeDef')) {
            if (!(typeof typeDef === 'function' && typeDef.length === 1)) invalidArgument('typeDef', typeDef);
            const innerTypeBuilder = typeDef(recurrentTypeBuilder);
            return function (context, fieldDef) {
              validator = innerTypeBuilder.call(this, context, fieldDef);
              return validator; // может быть undefined, если внутрений тип решил что проверять ничего не надо
            }
          }
        }
      );
    };
    return recurrentTypeBuilder;
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
