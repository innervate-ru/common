import prettyPrint from '../utils/prettyPrint'

export default function (typesExport) {

  const {VType, addType, addSubvalidator, addTypeAdvanced} = typesExport;

  addType('String', v => typeof v === 'string');
  addType('Int', v => Number.isInteger(v));
  addType('Float', v => typeof v == 'number' && !isNaN(v));
  addType('Bool', v => typeof v == 'boolean');
  addType('Object', v => typeof v === 'object' && !Array.isArray(v));
  // addType('Array', v => Array.isArray(v));
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
      return anArrayValidator;
    };

    return function (elementDefinition) {
      if (elementDefinition === undefined) return generalArrayTypeBuilder;
      else {
        const arrayValidatorWithItemsValidationBuilder = Object.create(typeContextPrototype);
        arrayValidatorWithItemsValidationBuilder._vtype = 'Array';
        arrayValidatorWithItemsValidationBuilder._build = function () {
          return typeContextPrototype._build.call(this,
            function (context, fieldDef) {
              const invalidFieldValue = this.invalidFieldValue;
              const validateNull = this.validateNull;
              const elementValidator = validateNull.call(this, (() => `${context()}:VType.Array(...)`), elementDefinition);
              if (!elementValidator) return anArrayValidator.call(this, context, fieldDef);
              return function (context, value, message, validateOptions) {
                if (!Array.isArray(value)) {
                  (message || (message = [])).push(invalidFieldValue(context, value));
                  return message;
                }
                let i;
                const itemContext = () => `${context()}[${i}]`;
                for (i = 0; i < value.length; i++)
                  message = elementValidator(itemContext, value[i], message, validateOptions) || message;
                return message;
              }
            });
        };
        return arrayValidatorWithItemsValidationBuilder;
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

  //addSubvalidator(VType.Array(), 'notEmpty', v => v.length > 0);
  addSubvalidator(VType.Array(), 'notEmpty', (v) => v.length > 0 ? true : `array is empty`);
  addSubvalidator(VType.Array(), 'onlyStrings', v => v.every(t => typeof t === 'string') ? true : 'not all strings');

}
