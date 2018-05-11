import tedious from 'tedious'
import prettyPrint from '../utils/prettyPrint'

const TYPES = tedious.TYPES; // http://tediousjs.github.io/tedious/api-datatypes.html

/**
 * Таблица для перевода строчного названия типа в тип пакета tedious.  При этом в map входя все специфичные типы, которые есть в tedious.
 */
export const stringToTediousTypeMap = (function() {
  const map = Object.create(null);
  // TODO: Добавить Boolean
  // TODO: Добавить варианты даты и времени
  map['str'] = TYPES.NVarChar;
  map['string'] = TYPES.NVarChar;
  map['int'] = TYPES.Int;
  map['integer'] = TYPES.Int;
  map['float'] = TYPES.Float;
  map['bool'] = TYPES.Bit;
  map['boolean'] = TYPES.Bit;
  map['bit'] = TYPES.Bit;
  map['datetime'] = TYPES.DateTime;
  map['date'] = TYPES.DateTime; // TODO: перепроверить соответствие
  map['time'] = TYPES.DateTime; // TODO: перепроверить соответствие
  map['varbinary'] = TYPES.VarBinary; // TODO: перепроверить соответствие
  
  for (const typeName in TYPES) map[typeName] = TYPES[typeName];
  return map;
})();

/**
 * Автоподбор типа, на основании значения аргумента.
 */
export function tediouseTypeByValue(value) {
  if (value === null) return TYPES.NVarChar;
  switch (typeof value) {
    case 'string': return TYPES.NVarChar;
    case 'number': return TYPES.Float;
    case 'boolean': return TYPES.Bit;
  }
  throw new Error(`There is no a default MsSql for given value: ${prettyPrint(value)}`);
}
