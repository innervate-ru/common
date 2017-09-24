import test from 'ava'
import prettyPrint from '../utils/prettyPrint'

test.beforeEach(t => {
  t.context.ctx = {
    invalidFieldValue: (context, value, reason) => `Invalid '${context()}'${reason ? ` (reason: ${reason})` : ''}: ${prettyPrint(value)}`,
  }
});

test(`добавление и получение типа простого тип`, t => {
  const {VType, addType} = require('./types')._module();

  addType('String', v => typeof v === 'string');

  t.throws(() => addType(), `Missing argument 'typeName'`); // нет первого аргумента
  t.throws(() => addType('string'), `Missing argument 'typePureValidator'`); // нет второго аргумента
  t.throws(() => addType('string', v => typeof v === 'string'), `Invalid argument 'typeName': 'string'`); // имя типа должно начинаться с большой буквы
  t.throws(() => addType('String', 12), `Invalid argument 'typePureValidator': 12`); // второй аргумент не метод
  t.throws(() => addType('String', () => {}), `Invalid argument 'typePureValidator': 'function () {}'`); // у метода проверки, должен быть аргумент

  t.is(typeof VType.String, 'function');
  t.is(typeof VType.String(), 'object');
  t.throws(() => VType.Wrong(), `VType.Wrong is not a function`);

  t.is(VType.String.toString(), 'Instead VType.String use VType.String()'); // в сообщение о том, что это неизвестный тип, выводится hint что надо добавить к названию типа скобки
  t.is('' + VType.String, 'Instead VType.String use VType.String()'); // При этом если эту функцию вставить в текстовую строку, то она будет показана как название типа

  t.is(VType.String().toString(), 'String');
  t.is('' + VType.String(), 'String');

  const validateFactory = VType.String()._build();
  const runtimeValidate = validateFactory.call(t.context.ctx, undefined, 'fieldA', {});
  t.deepEqual(runtimeValidate(() => 'fieldA', 123), [`Invalid 'fieldA': 123`]);
});

test(`тип, на основе уже существующего типа`, t => {
  const {VType, addType, getPureValidator} = require('./types')._module();

  addType('String', v => typeof v === 'string');

  const stringValidator = getPureValidator('String'); // можно получить по имени типа
  t.is(getPureValidator(VType.String()), stringValidator); // и по VType типу ...и результат будет одним и тем же
  addType('String4', v => stringValidator(v) && v.length === 4);

  const validateFactory = VType.String4()._build();
  const runtimeValidate = validateFactory.call(t.context.ctx, undefined, 'fieldA', {});

  t.is(runtimeValidate(() => 'fieldA', '1234'), undefined);
  t.deepEqual(runtimeValidate(() => 'fieldA', '123'), [`Invalid 'fieldA': '123'`]);
});

test(`добавление и использование subvalidator'а одного и нескольких`, t => {
  try {
    const {VType, addType, addSubvalidator, getPureValidator} = require('./types')._module();

    addType('String', v => typeof v === 'string');
    addSubvalidator(VType.String(), 'itsABC', v => v === 'abc' ? true : 'not abc');
    addSubvalidator(VType.String(), 'itsDEF', v => v === 'def' ? true : 'not def');

    t.throws(() => VType.String().wrong(), `VType.String(...).wrong is not a function`);
    t.throws(() => VType.String.wrong(), `VType.String.wrong is not a function`);
    // t.throws(() => VType.String.itsABC(), `VType.String.wrong is not a function`); // неприятная ситуация, когда забыли поставить скобки около типа.

    const buildTimeValidator1 = VType.String().itsABC()._build();
    const runtimeValidator1 = buildTimeValidator1.call(t.context.ctx, undefined, 'aField', {});
    t.is(runtimeValidator1(() => 'aField', 'abc'), undefined);
    t.deepEqual(runtimeValidator1(() => 'aField', ''), [`Invalid 'aField' (reason: not abc): ''`]);
    t.deepEqual(runtimeValidator1(() => 'aField', 12), [`Invalid 'aField': 12`]);

    const buildTimeValidator2 = VType.String().itsABC().itsDEF()._build();
    const runtimeValidator2 = buildTimeValidator2.call(t.context.ctx, undefined, 'aField', {});
    t.is(runtimeValidator2(() => 'aField', 'abc'), undefined);
    t.is(runtimeValidator2(() => 'aField', 'def'), undefined);
    t.deepEqual(runtimeValidator2(() => 'aField', 'xyz'), [`Invalid 'aField' (reason: not abc, not def): 'xyz'`]);
    t.deepEqual(runtimeValidator2(() => 'aField', 12), [`Invalid 'aField': 12`]);

    const buildTimeValidator3 = VType.String().itsDEF().itsABC()._build();
    const runtimeValidator3 = buildTimeValidator3.call(t.context.ctx, undefined, 'aField', {});
    t.is(runtimeValidator3(() => 'aField', 'abc'), undefined);
    t.is(runtimeValidator3(() => 'aField', 'def'), undefined);
    t.deepEqual(runtimeValidator3(() => 'aField', 'xyz'), [`Invalid 'aField' (reason: not abc, not def): 'xyz'`]);
    t.deepEqual(runtimeValidator3(() => 'aField', 12), [`Invalid 'aField': 12`]);
  } catch (err) {
    console.error(err);
  }
});

test(`функции для одинковых наборов сабвалидаторов повторно используются - flyweight pattern`, t => {
  const {VType, addType, addSubvalidator} = require('./types')._module();

  addType('String', v => typeof v === 'string');
  addSubvalidator(VType.String(), 'itsABC', v => v === 'abc');
  addSubvalidator(VType.String(), 'itsDEF', v => v === 'def');

  const buildTimeValidator1 = VType.String().itsABC().itsDEF()._build();
  const buildTimeValidator2 = VType.String().itsDEF().itsABC()._build();
  const buildTimeValidator3 = VType.String().itsABC().itsDEF().itsABC().itsDEF()._build();

  t.true(buildTimeValidator1 === buildTimeValidator2);
  t.true(buildTimeValidator1 === buildTimeValidator3);
});

test(`Можно добавлять сложные типы, такие как Fields`, t => {
  const {VType, addTypeAdvanced} = require('./types')._module();

  addTypeAdvanced('AComplexType', function (typeContextPrototype) {
    return function (v1) {
      const context = Object.create(typeContextPrototype); // подключение предоставленного протитотипа, позволяет подключать сабвалидаторы
      context._vtype = 'AComplexType';
      context._build = function () {
        return function (context, fieldDef) {
          const invalidFieldValue = this.invalidFieldValue;
          return function (context, value, message, validateOptions) {
            if (value === v1) return;
            (message || (message = [])).push(invalidFieldValue(context, value));
            return message;
          }
        };
      };
      return context;
    }
  });

  const buildTimeValidator = VType.AComplexType(12)._build();
  const runtimeValidator = buildTimeValidator.call(t.context.ctx, undefined, 'aField', {});
  t.is(runtimeValidator(() => 'aField', 12), undefined);
  t.deepEqual(runtimeValidator(() => 'aField', 'xyz'), [`Invalid 'aField': 'xyz'`]);
});
