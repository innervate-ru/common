import prettyPrint from '../utils/prettyPrint'

export default function (typesExport) {

  const {VType, addType, addSubvalidator, addTypeAdvanced} = typesExport;

  addType('String', v => typeof v === 'string');
  addType('Int', v => Number.isInteger(v));
  addType('Float', v => typeof v == 'number' && !isNaN(v));
  addType('Bool', v => typeof v == 'boolean');
  addType('Object', v => typeof v === 'object' && !Array.isArray(v));
  addType('Array', v => Array.isArray(v));
  addType('Function', v => typeof v === 'function');
  addType('Promise', v => v => typeof v === 'object' && v != null && 'then' in v);

  addTypeAdvanced('Fields', function (typeContextPrototype) {
    return function (fields) {
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

  // addTypeAdvanced('Array', function (typeContextPrototype) {
  //   const simpleContext = Object.create(typeContextPrototype); // общий случай без проверки элементов массива
  //   simpleContext._vtype = 'Array';
  //   simpleContext._build = function () {
  //     return function (fieldNamePrefix, fieldName, fieldDef) {
  //       const invalidFieldValue = this.invalidFieldValue;
  //       return function (value, message, validationContext) {
  //         if (Array.isArray(value[fieldName])) return;
  //         (message || (message = [])).push(invalidFieldValue(value, fieldName));
  //         return message;
  //       }
  //     }
  //   };
  //   return function (elementDefinition) {
  //     if (elementDefinition === undefined)
  //       return simpleContext;
  //     else if (typeof elementDefinition === 'object' && elementDefinition !== null && !Array.isArray(elementDefinition)) {
  //       const typeContext = Object.create(typeContextPrototype); // общий случай без проверки элементов массива
  //       typeContext._vtype = 'Array';
  //       typeContext._build = function () {
  //         return function (fieldNamePrefix, fieldName, fieldDef) {
  //           const invalidFieldValue = this.invalidFieldValue;
  //           const validateNull = this.validateNull;
  //           return function (value, message, validationContext) {
  //             const value = value[fieldName];
  //             if (Array.isArray(value)) {
  //               for (let i = 0; i < value.length; i++) {
  //                 message = validateNull(value)
  //               }
  //
  //
  //
  //             }
  //             (message || (message = [])).push(invalidFieldValue(value, fieldName));
  //             return message;
  //           }
  //         }
  //       };
  //       return typeContext;
  //     } else throw new Error(`Invalid array element declaration: ${prettyPrint(elementDefinition)}`);
  //
  //
  //
  //
  //
  //
  //     return function (fieldNamePrefix, fieldName, fieldDef) {
  //       const invalidFieldValue = this.invalidFieldValue;
  //       const validateNull = this.validateNull;
  //       return function (value, message, validationContext) {
  //
  //
  //
  //       };
  //     };
  //   };
  // });
  //
  //
  //

    // if (elementDefinition) { // каждый элемент массива проверяется на соответствие.  Для ошибок в контекст добавлен индекс элемента
    //   validateNull()
    //
    //
    // } else {
    //   return {
    //     _vtype: 'Array',
    //     _build() {
    //       return function (fieldNamePrefix, fieldName, fieldDef) {
    //         const invalidFieldValue = this.invalidFieldValue;
    //         return function (value, message, validationContext) {
    //           if (Array.isArray(value[fieldName])) return;
    //           (message || (message = [])).push(invalidFieldValue(value, fieldName));
    //           return message;
    //         }
    //       }
    //     },
    //   };
    // }


// String

  addSubvalidator(VType.String(), 'notEmpty', v => v.length > 0);
  addSubvalidator(VType.String(), 'noSpaces', v => /^\S*$/.test(v));

// Int

  addSubvalidator(VType.Int(), 'zero', v => v === 0);
  addSubvalidator(VType.Int(), 'positive', v => v > 0);
  addSubvalidator(VType.Int(), 'negative', v => v < 0);

// Float

  addSubvalidator(VType.Float(), 'zero', v => v === 0);
  addSubvalidator(VType.Float(), 'positive', v => v > 0);
  addSubvalidator(VType.Float(), 'negative', v => v < 0);

// Array

  addSubvalidator(VType.Array(), 'notEmpty', v => v.length > 0);
  addSubvalidator(VType.Array(), 'onlyStrings', v => v.every(t => typeof t === 'string'));

}
