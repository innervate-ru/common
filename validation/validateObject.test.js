// TODO: переделать определение полей в массив - чтобы соблюдать последовательность

import test from 'ava'
import prettyPrint from '../utils/prettyPrint'

import {validateObjectFactory, validateAndCopyOptionsFactory, validateOptionsFactory, validateEventFactory} from './validateObject'
const missingField = (value, optionName) => `Missing '${optionName}'`;
const unexpectedField = (value, optionName) => `Unexpected '${optionName}': ${prettyPrint(value[optionName])}`;
const invalidFieldValue = (value, optionName) => `Invalid '${optionName}': ${prettyPrint(value[optionName])}`;

const validateObject = validateObjectFactory({missingField, unexpectedField, invalidFieldValue});
const {_validateListOfTypes, _validateValidate, _validateRequired, _copyField, _validateNull, _validateType} = validateObject;

const validateObjectWithCopy = validateObjectFactory({
  missingField,
  unexpectedField,
  invalidFieldValue,
  copyFields: true
});
const {_validateRequired: _validateRequiredWithCopy} = validateObjectWithCopy;

for (const [type, rightValue, wrongValue] of [
  ['str', 'test string', 1],
  ['string', 'test string', 2],
  ['int', 11, 'str'],
  ['integer', 12, 20.12],
  ['float', 12.34, 'str'],
  ['bool', true, 'str'],
  ['boolean', false, 'str'],
  ['object', {}, []],
  ['array', [], {}],
  ['function', function () {}, {}],
]) {
  test(`_validateType[${type}, ${rightValue}, ${wrongValue}]`, t => {
    const validateType = _validateType('n', type);
    t.is(validateType({n: rightValue}, null), undefined);
    t.deepEqual(validateType({n: wrongValue}, null), [`Invalid 'n': ${prettyPrint(wrongValue)}`]);
  });
}

test(`_validateNotNull`, t => {
  const notNullCheck = _validateNull('optionN', {type: 'int', null: false});
  t.is(notNullCheck({optionN: 12}, null), undefined);
  t.deepEqual(notNullCheck({optionN: null}, null), [`Invalid 'optionN': null`]); // первое сообщение в списке
  t.deepEqual(notNullCheck({optionN: null}, [`err`]), [`err`, `Invalid 'optionN': null`]); // не первое сообщение в списке

  const nullableCheck = _validateNull('optionN', {type: 'int', null: true});
  t.is(nullableCheck({optionN: 12}, null), undefined);
  t.is(nullableCheck({optionN: null}, null), undefined);
  t.is(nullableCheck({optionN: null}, [`err`]), undefined);

  const notNullCheck2 = _validateNull('optionN', {type: 'int', null: false}); // null по умолчанию false
  t.is(notNullCheck2({optionN: 12}, null), undefined);
  t.deepEqual(notNullCheck2({optionN: null}, null), [`Invalid 'optionN': null`]); // первое сообщение в списке
  t.deepEqual(notNullCheck2({optionN: null}, [`err`]), [`err`, `Invalid 'optionN': null`]); // не первое сообщение в списке
});

test(`_validateRequired`, t => {
  const context = {anyCopyFunc: false};
  const requiredCheck = _validateRequired.call(context, 'optionN', {type: 'int', required: true});
  t.is(requiredCheck({optionN: 12}, null), undefined);
  t.deepEqual(requiredCheck({}, null), [`Missing 'optionN'`]); // первое сообщение в списке
  t.deepEqual(requiredCheck({}, [`err`]), [`err`, `Missing 'optionN'`]); // не первое сообщение в списке

  const notRequiredCheck = _validateRequired.call(context, 'optionN', {type: 'int', required: false});
  t.is(notRequiredCheck({optionN: 12}, null), undefined);

  const notRequiredCheck2 = _validateRequired.call(context, 'optionN', {type: 'int'}); // required по умолчанию false
  t.is(notRequiredCheck2({optionN: 12}, null), undefined);
});

test(`_copyField`, t => {
  const context = {anyCopyFunc: false};
  const requiredWithCopyCheck = _validateRequiredWithCopy.call(context, 'optionN', {type: 'int', copy: true});
  const dest = {};
  t.is(requiredWithCopyCheck.call(context, {optionN: 12}, null, {copyTo: dest}), undefined);
  t.deepEqual(dest, {_optionN: 12});

  const requiredWithoutCopyCheck = _validateRequired.call(context, 'optionN', {type: 'int', copy: true}); // поле не будет копироваться, так как _validateRequired создан с опцией copyFields: false
  const dest2 = {};
  t.is(requiredWithoutCopyCheck({optionN: 12}, null, {copyTo: dest2}), undefined);
  t.deepEqual(dest2, {});

  const copyByFunction = _validateRequiredWithCopy.call(context, 'optionN', {
    type: 'int',
    copy: (value, message, validateOptions) => {
      validateOptions.copyTo.optionN = value.optionN + 1
    }
  });
  const dest3 = {};
  t.is(copyByFunction.call(context, {optionN: 12}, null, {copyTo: dest3}), undefined);
  t.deepEqual(dest3, {optionN: 13});
});

test(`_validateValidate`, t => {
  const context = {anyCopyFunc: false};
  const validateValidate = _validateRequired.call(context, 'optionN', {
    type: 'int', required: true, validate: (fieldName, fieldDef) => (value, message, validateOptions) => {
      t.true(validateOptions == undefined || validateOptions.v == true); // validateOptions передаются в validate
      if (value.optionN == 12) {
        (message || (message = [])).push(`Should not be 12`);
        return message;
      }
    }
  });
  t.is(validateValidate.call(context, {optionN: 1}, null, {v: true}), undefined);
  t.deepEqual(validateValidate.call(context, {optionN: 12}, null), [`Should not be 12`]);
  t.deepEqual(validateValidate.call(context, {optionN: 12}, [`err`]), [`err`, `Should not be 12`]);
  t.deepEqual(validateValidate.call(context, {}, null), [`Missing 'optionN'`]);
  t.deepEqual(validateValidate.call(context, {}, [`err`]), [`err`, `Missing 'optionN'`]);
});

test(`_validateListOfTypes`, t => {
  const context = {anyCopyFunc: false};

  const validateListOfTypes = validateObject({optionN: {type: ['str', 'int'], null: true}});
  t.is(validateListOfTypes({optionN: 'test'}), undefined);
  t.is(validateListOfTypes({optionN: null}), undefined);
  t.is(validateListOfTypes({optionN: 12}), undefined);
  t.is(validateListOfTypes({}), undefined); // так как тип str, не содердит required: true
  t.deepEqual(validateListOfTypes({optionN: true}), [`Invalid 'optionN': true`]); // оба типа не подходят

  const validateListOfTypes2 = validateObject({optionN: {type: ['str'], null: false, required: true}}); // только один тип в списке
  t.is(validateListOfTypes({optionN: 'test'}), undefined);
  t.deepEqual(validateListOfTypes2({}), [`Missing 'optionN'`]);
  t.deepEqual(validateListOfTypes2({optionN: null}), [`Invalid 'optionN': null`]);
  t.deepEqual(validateListOfTypes2({optionN: 12}), [`Invalid 'optionN': 12`]);
  t.deepEqual(validateListOfTypes2({optionN: true}), [`Invalid 'optionN': true`]); // обе вариант ошибок
});

test(`validate by function`, t => {
  const context = {anyCopyFunc: false};
  const validate = _validateRequired.call(context, 'optionN', {
    type: ((fieldName, fieldDef) => (value, message, validateOptions) => {
      if (value.optionN != validateOptions.val) {
        (message || (message = [])).push(`Must be ${validateOptions.val}`);
        return message;
      }
    })
  });
  t.is(validate.call(context, {optionN: 12}, null, {val: 12}), undefined);
  t.deepEqual(validate.call(context, {optionN: 10}, null, {val: 12}), [`Must be 12`]);

  const validate2 = validateObject({
    optionN: {
      type: [((fieldName, fieldDef) => (value, message, validateOptions) => {
        if (value.optionN != 21) {
          (message || (message = [])).push(`Must be 21`);
          return message;
        }
      }), 'bool'], required: true, null: true
    }
  });
  t.is(validate2({optionN: 21}), undefined);
  t.is(validate2({optionN: null}), undefined);
  t.is(validate2({optionN: false}), undefined);
  t.deepEqual(validate2({optionN: 15}), [`Invalid 'optionN': 15`]);
  t.deepEqual(validate2({}), [`Missing 'optionN'`]);
});

test(`_extend`, t => {
  const parentConfig = validateObject({name: {type: 'str'}});
  const config = validateObject({_extends: parentConfig, id: {type: 'int'}});
  t.throws(() => validateObject({_extends: parentConfig, name: {type: 'int'}})); // повторное объявление поля name
});

for (const v of [12, true, 'test', {}, [], function () {
}])
  test(`не верное значение _extend: ${prettyPrint(v)}`, t => {
    t.throws((() => validateObject({
      _extends: v,
      name: {type: 'int'}
    })), `Invalid value of _extends: ${prettyPrint(v)}`);
  });

test(`wrong named props`, t => {
  t.throws(() => validateObject({name: {type: 'str'}, _wrong: {type: 'int'}})); // ошибка, что поле _wrong не может быть именем поля
});

test(`_validate для схемы вызывается вне зависимости от успешности остальных проверок.  их результат можно узнать из параметра messages`, t => {
  let lastMessage = 123;
  const validate = validateObject({
    name: {type: 'str'}, optionN: {type: 'int'}, _validate: (value, message, validateOptions) => {
      lastMessage = message; // если есть message, то значит найденны ошибки.  И можно проверку всего объекта не проводить
      if (value.optionN != 12) {
        (message || (message = [])).push(`'optionN' must be 12`);
        return message;
      }
    }
  });
  t.is(validate({name: 'test', optionN: 12}), undefined);
  t.is(lastMessage, undefined);

  t.deepEqual(validate({name: 'test', optionN: 21}), [`'optionN' must be 12`]);
  t.is(lastMessage, undefined); // ошибок при входе в validate не было

  t.deepEqual(validate({name: 22, optionN: 21}), [`Invalid 'name': 22`, `'optionN' must be 12`]);
  t.deepEqual(lastMessage, [`Invalid 'name': 22`, `'optionN' must be 12`]); // так как массив ошибок уже был при выполнении validate, в него добавилось ещё одно сообщение
});

test(`required fields will be reported event if argument is null or undefined`, t => {
  const validate = validateObject({optionN: {type: 'str', required: true}}, {type: 'int', required: true});
  t.deepEqual(validate(undefined, null), [`Missing 'optionN'`]); // ошибка что полей нет, даже когда структура пустая
  t.deepEqual(validate(null, null), [`Missing 'optionN'`]); // ошибка что полей нет, даже когда структура пустая
});

test(`invalid argument will cause 'validate' to fail`, t => {
  const validate = validateObject({optionN: {type: 'str', required: true}}, {type: 'int', required: true});
  t.throws(() => validate(true), `Invalid argument 'value': true`);
  t.throws(() => validate(false), `Invalid argument 'value': false`);
  t.throws(() => validate('wrong'),  `Invalid argument 'value': 'wrong'`);
  t.throws(() => validate(12), `Invalid argument 'value': 12`);
});

test(`if any field with 'copy' then 'copyTo' option is required`, t => {
  const validateWithCopy = validateObjectWithCopy({optionN: {type: 'str', copy: true}});
  t.throws(() => validateWithCopy({optionN: 'test'}), `Missing field 'copyTo': undefined`);
  t.throws(() => validateWithCopy({optionN: 'test'}, 'wrong'), `Invalid argument 'validateOptions': 'wrong'`);
  t.throws(() => validateWithCopy({optionN: 'test'}, {}), `Missing field 'copyTo': {}`);
  t.throws(() => validateWithCopy({optionN: 'test'}, {copyTo: 'wrong'}), `Invalid option 'copyTo': 'wrong'`);
  const dest = {};
  t.is(validateWithCopy({optionN: 'test'}, {copyTo: dest}), undefined);
  t.deepEqual(dest, {_optionN: 'test'});
});

test(`'validateAndCopyOptionsFactory' работает только для свой части опций`, t => {
  const parentValidate = validateAndCopyOptionsFactory({
    name: {type: 'string', required: true},
  });
  const childValidate = validateAndCopyOptionsFactory({
    _extends: parentValidate,
    connection: {type: 'string', required: true},
  });

  t.is(parentValidate({name: 'test'}), undefined);
  t.throws(() => parentValidate({})); // нет поля name

  t.is(childValidate({connection: '123'}), undefined); // всё в пордке, не смотря на то что нет поля name нуного для parentValidate
  t.throws(() => {
    childValidate({});
  }); // нет поля connection

  t.throws(() => validateAndCopyOptionsFactory({
    _extends: parentValidate, // _extends дает проверку, что в наследники не указаны те же поля, что и в предке
    connection: {type: 'name', required: true},
  }));
});

test(`'validateEventFactory' работает для всей иерархии проверок`, t => {
  const parentValidate = validateEventFactory({
    name: {type: 'string', required: true},
  }, {throwException: true}); // используем опцию throwException, чтобы не париться с перехватом и анализом вывода ошибок в console
  const childValidate = validateEventFactory({
    _extends: parentValidate,
    connection: {type: 'string', required: true},
  }, {throwException: true});

  // t.is(parentValidate({name: 'test'}), undefined);
  // t.throws(() => parentValidate({})); // нет поля name

  t.is(childValidate({name: 'test', connection: '123'}), undefined);
  // t.throws(() => { childValidate({connection: '123'}); }); // нет поля name
  // t.throws(() => { childValidate({}); }); // нет полей name и connection
});

test(`выдавать unexpected поля в validateEventFactory`, t => {
  // Прим.: Такоей проверки нет в validateAndCopyOptionsFactory, так как при наследовании классов нет возможности в классах предках знать опции, которые нужны классам наследникам
  const validate = validateEventFactory({
    name: {type: 'string', required: true},
    val: {type: 'int'},
  }, {throwException: true}); // используем опцию throwException, чтобы не париться с перехватом и анализом вывода ошибок в console

  t.is(validate({name: 'test'}), undefined);
  t.is(validate({name: 'test', val: 123}), undefined);
  t.throws((t => validate({
    name: 'test',
    val: 123,
    invalid: 'wrong'
  })), `Event {name: 'test', val: 123, invalid: 'wrong'}: Unexpected field 'invalid': 'wrong'`);
  t.throws((t => validate({
    name: 'test',
    invalidField: 321
  })), `Event {name: 'test', invalidField: 321}: Unexpected field 'invalidField': 321`);
});

test(`validate для поля, вызывается только если type, null и required проверки прошли успешно, и поле есть`, t => {
  let cnt = 0, v;
  const requiredValidate = validateObject({
    optionN: {
      type: 'string', required: true, null: true, validate: v = (fieldName, fieldDef) => (value, message, validateOptions) => {
        cnt++;
      }
    }
  });
  const notRequiredValidate = validateObject({optionN: {type: 'string', validate: v}});

  t.deepEqual(requiredValidate({}), [`Missing 'optionN'`]);
  t.is(cnt, 0);

  t.is(requiredValidate({optionN: null}), undefined); // значение правильное, но при null - validate не вызывается
  t.is(cnt, 0);

  t.deepEqual(requiredValidate({optionN: 123}), [`Invalid 'optionN': 123`]);
  t.is(cnt, 0);

  t.is(requiredValidate({optionN: 'test'}), undefined); // значение правильное и не null - validate вызывается
  t.is(cnt, 1);

  t.deepEqual(notRequiredValidate({}), undefined); // если поля нет, то validatre не вызывается
  t.is(cnt, 1);

  t.deepEqual(notRequiredValidate({optionN: null}), [`Invalid 'optionN': null`]);
  t.is(cnt, 1);

  t.is(notRequiredValidate({optionN: 'test'}), undefined); // значение правильное и не null - validate вызывается
  t.is(cnt, 2);
});

test(`validateAndCopyOptionsFactory / validateOptionsFactory детали поведения`, t => {

  const schemaWithRequired = {
    num: {type: 'int'},
    requiredNum: {type: 'int', required: true},
    copiedNum: {type: 'int', copy: true},
  };
  const validateWithCopy = validateAndCopyOptionsFactory(schemaWithRequired);
  const validate = validateOptionsFactory(schemaWithRequired);

  const schemaWithoutRequiredAndCopy = {
    num: {type: 'int'},
  };
  const validateWithCopyWithoutRequiredAndCopy = validateAndCopyOptionsFactory(schemaWithoutRequiredAndCopy);
  const validateWithoutRequiredAndCopy = validateOptionsFactory(schemaWithoutRequiredAndCopy);

  // когда всё в порядке
  const dest1 = {};
  validateWithCopy({num: 1, requiredNum: 2, copiedNum: 3}, {copyTo: dest1});
  t.deepEqual(dest1, {_copiedNum: 3});

  const dest2 = {};
  validate({num: 1, requiredNum: 2, copiedNum: 3}, {copyTo: dest2});
  t.deepEqual(dest2, {});

  // если для validateAndCopyOptionsFactory не указан опция валидации copyTo - ошибка
  t.throws(() => validateWithCopy({num: 1, requiredNum: 2, copiedNum: 3}), `Missing field 'copyTo': undefined`);
  // есть validateOptions но нет поля copyTo
  t.throws(() => validateWithCopy({num: 1, requiredNum: 2, copiedNum: 3}, {}), `Missing field 'copyTo': {}`);
  // есть validateOptions но нет поля copyTo не объект
  t.throws(() => validateWithCopy({num: 1, requiredNum: 2, copiedNum: 3}, {copyTo: 12}), `Invalid option 'copyTo': 12`);

  // validateOptionsFactory игнорируется признак copy - ошибки нет, даже когда нет опции copyTo
  validate({num: 1, requiredNum: 2, copiedNum: 3});

  // если нет объект validateOptions, то всё равно возвращается сообщение об отсутствии обязательных полей
  const dest3 = {};
  t.throws(() => validateWithCopy(undefined, {copyTo: dest3}), `Invalid argument 'value': Missing required field 'requiredNum'`);
  t.throws(() => validate(undefined, {copyTo: dest3}), `Invalid argument 'value': Missing required field 'requiredNum'`);
  t.throws(() => validateWithCopy(null, {copyTo: dest3}), `Invalid argument 'value': Missing required field 'requiredNum'`);
  t.throws(() => validate(null, {copyTo: dest3}), `Invalid argument 'value': Missing required field 'requiredNum'`);

  // если нет поля, которое надо скопировать - ничего не делаем ...а можно предусмотреть default
  const dest4 = {};
  validateWithCopy({num: 1, requiredNum: 2}, {copyTo: dest4});
  t.deepEqual(dest4, {});
  validate({num: 1, requiredNum: 2}, {copyTo: dest4}); // хотя validate вообще не смотрит на опции copyTo
  t.deepEqual(dest4, {});

  // если нет обязательного поля - ругаемся
  const dest5 = {};
  t.throws(() => validateWithCopy({num: 1}, {copyTo: dest5}), `Invalid argument 'value': Missing required field 'requiredNum'`);
  t.throws(() => validate({num: 1}), `Invalid argument 'value': Missing required field 'requiredNum'`);

  // если схема не содержит required и не содержит полей с пирзнаком copy, то copyTo не требуется, и при остуствующем объекте ошибки не возникает
  validateWithCopyWithoutRequiredAndCopy(undefined);
  validateWithoutRequiredAndCopy(undefined);
  validateWithCopyWithoutRequiredAndCopy(null);
  validateWithoutRequiredAndCopy(null);
});
