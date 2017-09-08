export default function (typesExport) {

  const {VType, addType, addSubvalidator, addTypeAdvanced} = typesExport;

  addType('String', v => typeof v === 'string');
  addType('Int', v => Number.isInteger(v));
  addType('Float', v => typeof v == 'number' && !isNaN(v));
  addType('Bool', v => typeof v == 'boolean');
  addType('Object', v => typeof v === 'object' && !Array.isArray(v));
  addType('Array', v => Array.isArray(v));
  addType('Function', v => typeof v === 'function');

  addTypeAdvanced('Fields', function (fields) {
    return {
      _vtype: 'Fields',
      _build() {
        return function (fieldNamePrefix, fieldName, fieldDef) {
          return this.validateSubfields(fieldNamePrefix, fieldName, fieldDef, fields);
        }
      },
    };
  });

// String

  addSubvalidator(VType.String(), 'notEmpty', v => v.length() > 0);
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

  addSubvalidator(VType.Float(), 'onlyStrings', v => v.every(t => typeof t === 'string'));

}
