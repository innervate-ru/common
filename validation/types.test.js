import test from 'ava'
import prettyPrint from '../utils/prettyPrint'

//import {VType, addType, addSubvalidator} from './types';

test.only(`добавление и получение типа простого тип`, t => {
  const {VType, addType} = require('./types')._module();

  addType('String', v => typeof v === 'string');

  t.throws(() => addType(), `Missing argument 'typeName'`); // нет первого аргумента
  t.throws(() => addType('string'), `Missing argument 'typePureValidator'`); // нет второго аргумента
  t.throws(() => addType('string', v => typeof v === 'string'), `Invalid argument 'typeName': 'string'`); // имя типа должно начинаться с большой буквы
  t.throws(() => addType('String', 12), `Invalid argument 'typePureValidator': 12`); // второй аргумент не метод
  t.throws(() => addType('String', () => {}), `Invalid argument 'typePureValidator': function () {}`); // у метода проверки, должен быть аргумент

  t.is(typeof VType.String(), 'function');
  t.throws(() => VType.Wrong(), `Type is not defined: 'Wrong'`);

  const validator = VType.String(undefined, 'aField', {});
  t.is(validator({aField: 'string'}, undefined, undefined), undefined);
  t.deepEqual(validator({aField: 12}, undefined, undefined), [`Invalid field 'aField' value: 12`]);
});

test(`тип, на основе уже существующего типа`, t => {
  const {VType, addType, getPureValidator} = require('./types')._module();

  addType('String', v => typeof v === 'string');

  const stringValidator = getPureValidator(VType.String);
  addType('String4', v => stringValidator(v) && v.length === 4);

  const validator = VType.String4(undefined, 'aField', {});
  t.is(validator({aField: '1234'}, undefined, undefined), undefined);
  t.deepEqual(validator({aField: '123'}, undefined, undefined), [`Invalid field 'aField' value: '123'`]);
});

test(`добавление и использование subvalidator'а одного и нескольких`, t => {
  const {VType, addType, addSubvalidator} = require('./types')._module();

  addType('String', v => typeof v === 'string');
  addSubvalidator(VType.String, 'ItsABC', v => v === 'abc');
  addSubvalidator(VType.String, 'ItsDEF', v => v === 'def');

  t.throws(() => VType.String.wrong, `Validator is not defined: 'String.wrong'`);

  const validator1 = VType.String.ItsABC(undefined, 'aField', {});
  t.is(validator1({aField: 'abc'}, undefined, undefined), undefined);
  t.deepEqual(validator1({aField: ''}, undefined, undefined), [`Invalid field 'aField' value: ''`]);
  t.deepEqual(validator1({aField: 12}, undefined, undefined), [`Invalid field 'aField' value: 12`]);

  const validator2 = VType.String.ItsABC.ItsDEF(undefined, 'aField', {});
  t.is(validator2({aField: 'abc'}, undefined, undefined), undefined);
  t.is(validator2({aField: 'def'}, undefined, undefined), undefined);
  t.deepEqual(validator2({aField: 'xyz'}, undefined, undefined), [`Invalid field 'aField' value: 'xyz'`]);
  t.deepEqual(validator2({aField: 12}, undefined, undefined), [`Invalid field 'aField' value: 12`]);

  const validator3 = VType.String.ItsDEF.ItsABC(undefined, 'aField', {});
  t.is(validator3({aField: 'abc'}, undefined, undefined), undefined);
  t.is(validator3({aField: 'def'}, undefined, undefined), undefined);
  t.deepEqual(validator3({aField: 'xyz'}, undefined, undefined), [`Invalid field 'aField' value: 'xyz'`]);
  t.deepEqual(validator3({aField: 12}, undefined, undefined), [`Invalid field 'aField' value: 12`]);

});

test(`функции для одинковых наборов сабвалидаторов повторно используются - flyweight patter`, t => {
  const {VType, addType, addSubvalidator} = require('./types')._module();

  addType('String', v => typeof v === 'string');
  addSubvalidator(VType.String, 'ItsABC', v => v === 'abc');
  addSubvalidator(VType.String, 'ItsDEF', v => v === 'def');

  t.is(VType.String.ItsDEF.ItsABC.toString(), 'String_ItsABC_ItsDEF');
  t.is(VType.String.ItsABC.ItsDEF.toString(), 'String_ItsABC_ItsDEF');
  t.is(VType.String.ItsABC.ItsDEF.ItsABC.ItsDEF.ItsABC.ItsDEF.toString(), 'String_ItsABC_ItsDEF');
});

test(`поддержка сложных (расширенных) типов - VType.Fields({...})`, t => {
  const {VType, addType, addTypeAdvanced, addSubvalidator} = require('./types')._module();

  addTypeAdvanced('Int12', function (fieldNamePrefix, fieldName, fieldDef) {
    return function (value, message, validateOptions) {
      if (value[fieldName] !== 12) return;
      (message || (message = [])).push(`${fieldNamePrefix ? `${fieldNamePrefix}.${fieldName}` : fieldName}: Must not be 12`);
      return message;
    }
  });

  const validator = VType.Int12(undefined, 'a', {});
  t.is(validator({a: 1}), undefined);
  t.deepEqual(validator({a: 12}), [`a: Must not be 12`]); // Приходит кастомное сообщение

  addSubvalidator(VType.Int12, 'alwaysInvalid', v => false);
  const validator2 = VType.Int12.alwaysInvalid(undefined, 'a', {});
  t.deepEqual(validator2({a: 12}), [`Invalid field 'a' value: 12`]); // Приходит общее сообщение, так как кастмное перекрыто субвалидатором
});
