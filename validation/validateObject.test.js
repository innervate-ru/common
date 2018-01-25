// TODO: переделать определение полей в массив - чтобы соблюдать последовательность

import test from 'ava'
import prettyPrint from '../utils/prettyPrint'

import {
  validateObjectFactory,
  validateAndCopyOptionsFactory,
  validateOptionsFactory,
  validateEventFactory
} from './validateObject'
const missingField = (context) => `Missing '${context()}'`;
const unexpectedField = (context, value) => `Unexpected '${context()}': ${prettyPrint(value)}`;
const invalidFieldValue = (context, value, reason) => `Invalid '${context()}'${reason ? ` (reason: ${reason})` : ''}: ${prettyPrint(value)}`;

const validateObject = validateObjectFactory({missingField, unexpectedField, invalidFieldValue});

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
  ['function', function () {
  }, {}],
]) {
  test(`Атрибут 'type' = ${type}`, t => {
    const validate = validateObject({
      field: {type},
    });

    t.is(validate({field: rightValue}), undefined);
    t.deepEqual(validate({field: wrongValue}), [`Invalid 'field': ${prettyPrint(wrongValue)}`]);
  });
}

test(`Атрибут 'type' может быть объектом VType`, t => {
  const AType = {
    _vtype: 'AType',
    _build() {
      return function (context, fieldDef) {
        const invalidFieldValue = this.invalidFieldValue; // метод выдачи сообщения доступен через context
        return (context, value, message, validateOptions) => {
          if (value !== 12) return;
          (message || (message = [])).push(invalidFieldValue(context, value));
          return message;
        };
      };
    },
  };

  const validate = validateObject({
    fieldA: {type: AType,},
  });

  t.is(validate({fieldA: 1}), undefined);
  t.deepEqual(validate({fieldA: 12}), [`Invalid 'fieldA': 12`]);
});

test(`Атрибут 'type' как перечень вариантов типа`, t => {
  const context = {anyCopyFunc: false};

  // внимание: в перечне типов, можно так же использовать функции - как в тесте выше

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

test(`Атрибут 'null'`, t => {
  const validate = validateObject({
    a: {type: 'int', null: true},
    b: {type: 'int', null: false},
    c: {type: 'int'}, // по умолчанию - false
  });

  t.is(validate({a: 1, b: 2, c: 3}), undefined);
  t.is(validate({a: null, b: 2, c: 3}), undefined);

  t.deepEqual(validate({a: 1, b: null, c: 3}), [`Invalid 'b': null`]);
  t.deepEqual(validate({a: 1, b: 2, c: null}), [`Invalid 'c': null`]);
  t.deepEqual(validate({a: null, b: null, c: null}), [`Invalid 'b': null`, `Invalid 'c': null`]);
});

test(`Атрибут 'required'`, t => {
  const requiredValidate = validateObject({
    optionN: {type: 'int', required: true},
  });
  t.is(requiredValidate({optionN: 12}), undefined);
  t.deepEqual(requiredValidate({}), [`Missing 'optionN'`]);
  t.deepEqual(requiredValidate({optionN: undefined}), [`Missing 'optionN'`]); // поле равное undefined, считается отсутствующим

  // перечень обязательных полей, возвращается в том числе если вместо объекта было переданно null или undefined
  t.deepEqual(requiredValidate(undefined), [`Missing 'optionN'`]);
  t.deepEqual(requiredValidate(null), [`Missing 'optionN'`]);

  const notRequiredValidate = validateObject({
    optionN: {type: 'int', required: false},
  });
  t.is(notRequiredValidate({optionN: 12}), undefined);
  t.is(notRequiredValidate({}), undefined);

  const notRequiredValidate2 = validateObject({
    optionN: {type: 'int',}, // по умолчанию required: false
  });
  t.is(notRequiredValidate2({optionN: 12}), undefined);
  t.is(notRequiredValidate2({}), undefined);
});

test(`Атрибут 'copy'`, t => {
  // что копирование было доступно, надо создать validatorFactory c опцией copyFields: true
  const validateObjectWithCopy = validateObjectFactory({
    missingField,
    unexpectedField,
    invalidFieldValue,
    copyFields: true
  }); // вариант с копированием нужен только в этом тесте
  const validateWithCopy = validateObjectWithCopy({
    // можно указывать как true/false
    a: {type: 'int', copy: true},
    // как функцию
    b: {
      type: 'int', copy: function (context, fieldDef, fieldName) {
        return function (context, value, message, validateOptions) { // при копировании так же можно возвращать ошибки
          const target = validateOptions.copyTo;
          target.bCopy1 = value.b; // имя поля может быть в коде
          target.bCopy2 = value[fieldName]; // или можно сделать универсальный метод, который берет имя поля из fieldName
        };
      }
    },
    // по умолчанию - false
    c: {type: 'int'},
  });

  const dest = {};
  t.is(validateWithCopy({a: 1, b: 2, c: 3}, {copyTo: dest}), undefined);
  t.is(dest._a, 1); // внимание, копируется в поле, с подчерком в начале имени
  t.is(dest.bCopy1, 2); // скопированно методом
  t.is(dest.bCopy2, 2);
  t.false(hasOwnProperty.call(dest, '_c')); // по умолчанию - не копируется

  // опция copyTo обязательна, если есть поля с признаком copy
  t.throws(() => validateWithCopy({a: 12}), `Missing option 'copyTo': undefined`);
  t.throws(() => validateWithCopy({a: 12}, {anotherOption: true}), `Missing option 'copyTo': {anotherOption: true}`);

  // если валидатор создан через фабрику без опции copyFields: true, то признак copy игнорируется, и опция copyTo не трубуется
  const validateWithoutCopy = validateObject({
    // можно указывать как true/false
    a: {type: 'int', copy: true},
    // как функцию
    b: {
      type: 'int', copy: function (context, fieldDef, fieldName) {
        return function (context, value, message, validateOptions) { // при копировании так же можно возвращать ошибки
          const target = validateOptions.copyTo;
          target.bCopy1 = value.b; // имя поля может быть в коде
          target.bCopy2 = value[fieldName]; // или можно сделать универсальный метод, который берет имя поля из fieldName
        };
      }
    },
    // по умолчанию - false
    c: {type: 'int'},
  });

  const dest2 = {};
  t.is(validateWithoutCopy({a: 1, b: 2, c: 3}, {copyTo: dest2}), undefined);
  t.deepEqual(dest2, {});
  t.is(validateWithoutCopy({a: 12}), undefined); // ошибки что нет опции copyTo не возникает
  t.is(validateWithoutCopy({a: 12}, {anotherOption: true}), undefined); // ошибки что нет опции copyTo не возникает

  // признак copy нельзя использовать во вложенных полях - только на верхнем уровне
  t.throws(() => validateObject({
    a: {
      fields: {
        b: {copy: true},
      }
    }
  }), `Field 'a.b': For any subfield it is not allowed to have a 'copy' attribute`);

  // если поля нет в данных, то значение в объекте не затирается
  const dest3 = {_a: 'a', bCopy1: 'b', bCopy2: 'c'};
  t.is(validateWithCopy({c: 3}, {copyTo: dest3}), undefined);
  // полей для копирования не было, потому значение _а не изменились, а bCopy1 и bCopy2 изменились, так как нет проверки наличия исходного поля в кастомном методе копировании - см. выше
  // это позволяет задавать значение по умолчанию полями в jscript-классах
  t.deepEqual(dest3, {_a: 'a', bCopy1: undefined, bCopy2: undefined});
});

test(`Атрибут 'default'`, t => {
  // что копирование было доступно, надо создать validatorFactory c опцией copyFields: true
  const validateObjectWithCopy = validateObjectFactory({
    missingField,
    unexpectedField,
    invalidFieldValue,
    copyFields: true
  }); // вариант с копированием нужен только в этом тесте
  const validateWithCopy = validateObjectWithCopy({
    a: {type: 'int', copy: true, default: 12},
  });

  const obj = {};
  t.is(validateWithCopy({}, {copyTo: obj}), undefined);
  t.deepEqual(obj, {_a: 12}); // default значение

  t.is(validateWithCopy({a: 121}, {copyTo: obj}), undefined);
  t.deepEqual(obj, {_a: 121});

  t.throws(() => validateObjectWithCopy({
    a: {type: 'int', copy: true, default: 'wrong value type'},
  }), `Field 'a': Invalid value of 'default': 'wrong value type'`);
});

test(`Атрибут 'validate'`, t => {
  const validate = validateObject({
    optionN: {
      type: 'int', validate: (v, validateOptions) => {
        t.true(validateOptions == undefined || validateOptions.v == true); // validateOptions передаются в validate
        return v !== 12;
      }
    }
  });
  t.is(validate({optionN: 1}, {v: true}), undefined);
  t.deepEqual(validate({optionN: 12}), [`Invalid 'optionN': 12`]);
  t.deepEqual(validate({}), undefined); // validate не используется если нет значения
});

test(`Атрибут 'validate'. Можно указывать причину почему данные не верные`, t => {
  const validate = validateObject({
    optionN: {
      type: 'int', validate: (v, validateOptions) => {
        t.true(validateOptions == undefined || validateOptions.v == true); // validateOptions передаются в validate
        return v !== 12 ? true : 'not twelve';
      }
    }
  });
  t.is(validate({optionN: 1}, {v: true}), undefined);
  t.deepEqual(validate({optionN: 12}), [`Invalid 'optionN' (reason: not twelve): 12`]);
  t.deepEqual(validate({}), undefined); // validate не используется если нет значения
});

test(`_extend`, t => {
  const parentConfig = validateObject({name: {type: 'str'}});
  const config = validateObject({_extends: parentConfig, id: {type: 'int'}});
  t.throws(() => validateObject({_extends: parentConfig, name: {type: 'int'}})); // повторное объявление поля name
});

for (const v of [12, true, 'test', {}, [], function () {
}])
  test(`Не верное значение поля '_extend': ${prettyPrint(v)}`, t => {
    t.throws((() => validateObject({
      _extends: v,
      name: {type: 'int'}
    })), `Invalid value of _extends: ${prettyPrint(v)}`);
  });

test(`Имя поля в схеме не может начинаться с подчерка`, t => {
  t.throws(() => validateObject({name: {type: 'str'}, _wrong: {type: 'int'}})); // ошибка, что поле _wrong не может быть именем поля
});

test(`_validate для всего объекта вызывается вне зависимости от успешности остальных проверок`, t => {
  let lastMessage = 123;
  const validate = validateObject({
    name: {type: 'str'}, optionN: {type: 'int'}, _validate: (context, value, message, validateOptions) => { // если messages != undefined, значит предыдущие проверки вернули ошибку(и)
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

test(`Если как параметр передать не объект или null/undefined то будет выброшена ошибка`, t => {
  const validate = validateObject({optionN: {type: 'str', required: true}}, {type: 'int', required: true});
  t.throws(() => validate(true), `Invalid argument 'value': true`);
  t.throws(() => validate(false), `Invalid argument 'value': false`);
  t.throws(() => validate('wrong'), `Invalid argument 'value': 'wrong'`);
  t.throws(() => validate(12), `Invalid argument 'value': 12`);
});

test(`'validateAndCopyOptionsFactory' работает только для свой части опций, но при этом проверяет что у предка нет полей с такими же именами`, t => {
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
    name: {type: 'int', required: true},
  }), `Field 'name' is already defined in parent structure`);
});

test(`'validateEventFactory' работает для всей иерархии проверок`, t => {
  const parentValidate = validateEventFactory({
    name: {type: 'string', required: true},
  }, {throwException: true}); // используем опцию throwException, чтобы не париться с перехватом и анализом вывода ошибок в console
  const childValidate = validateEventFactory({
    _extends: parentValidate,
    connection: {type: 'string', required: true},
  }, {throwException: true});

  t.is(parentValidate({name: 'test'}), undefined);
  t.throws(() => parentValidate({})); // нет поля name

  t.is(childValidate({name: 'test', connection: '123'}), undefined);
  t.throws(() => {
    childValidate({connection: '123'});
  }); // нет поля name
  t.throws(() => {
    childValidate({});
  }); // нет полей name и connection
});

test(`выдавать unexpected поля в validateEventFactory`, t => {
  // Прим.: Такоей проверки нет в validateAndCopyOptionsFactory, так как при наследовании классов нет возможности в классах предках знать опции, которые нужны классам наследникам
  const validate = validateEventFactory({
    _final: true,
    name: {type: 'string', required: true},
    val: {type: 'int'},
  }, {throwException: true}); // используем опцию throwException, чтобы не париться с перехватом и анализом вывода ошибок в console

  t.is(validate({name: 'test'}), undefined);
  t.is(validate({name: 'test', val: 123}), undefined);

  t.throws((t => validate({
    name: 'test',
    val: 123,
    invalid: 'wrong'
  })), `Event {name: 'test', val: 123, invalid: 'wrong'}: Unexpected field 'invalid' with value: 'wrong'`);
  t.throws((t => validate({
    name: 'test',
    invalidField: 321
  })), `Event {name: 'test', invalidField: 321}: Unexpected field 'invalidField' with value: 321`);
});

test(`validate для поля, вызывается только если type, null и required проверки прошли успешно, и поле есть`, t => {
  let cnt = 0, v;
  const requiredValidate = validateObject({
    optionN: {
      type: 'string',
      required: true,
      null: true,
      validate: v => {
        cnt++;
        return true;
      }
    }
  });
  const notRequiredValidate = validateObject({
    optionN: {
      type: 'string', validate: v => {
        cnt++;
        return true;
      }
    }
  });

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

test(`Атрибут 'fields' вместо 'type'`, t => {
  const validate = validateObject({
    _final: true,
    a: {type: 'int'},
    b: {
      null: true,
      fields: {
        _final: false,
        c: {type: 'int'},
        d: {type: 'int', required: true},
      }
    },
    e: {
      required: true, fields: {
        f: {type: 'int', required: true},
      }
    },
    g: {
      fields: {
        _final: true,
        h: {type: 'int'},
      }
    },
  });

  t.is(validate({
    a: 12,
    b: {c: 1, d: 2},
    e: {f: 3},
  }), undefined);

  t.is(validate({
    // если убрать не обязательное поле (b: {c: 1, d: 2},), в котором есть обязательные поля - не проблема
    e: {f: 3},
  }), undefined);

  t.deepEqual(validate({
    a: 1,
  }), [`Missing 'e'`]);

  t.deepEqual(validate({
    b: {}, // значение есть, но в нем нет поля d
    e: {}, // значение есть, но в нем нет поля f
  }), [`Missing 'b.d'`, `Missing 'e.f'`]);

  t.is(validate({
    b: null, // если поле может быть null, то тогда обяхательные вложенные поля тоже не требуются
    e: {f: 3},
  }), undefined);

  t.is(validate({
    b: undefined, // undefined - считается что значения нет, и поле d не требуется
    e: {f: 3},
  }), undefined);

  // обязательные вложенные поля, не входя в список полей, если передать вместо объекта null/undefined
  t.deepEqual(validate(undefined), [`Missing 'e'`]);
  t.deepEqual(validate(null), [`Missing 'e'`]);

  // если есть вложенные поля, которых нет в схеме и в factory включена опция unexpected, то не ожиданные поля выдются если найдены
  t.deepEqual(validate({
    a: 12,
    b: {c: 1, d: 2, unexp: 'a'},
    e: {f: 3, anotherUnexp: false},
    g: {h: 12, unexp: 'test'},
    oneMoreUnexp: {v: 12},
  }), [
    // `Unexpected 'b.unexp': 'a'`, // эти ошибка не возникают, так как _final для этой структуры false
    // `Unexpected 'e.anotherUnexp': false`, // _final false по умолчанию
    `Unexpected 'g.unexp': 'test'`,
    `Unexpected 'oneMoreUnexp': {v: 12}`,
    ]);

  const validate2 = validateObject({
    a: {
      fields: {
        b: {
          null: true, fields: {
            c: {type: 'int'},
            d: {type: 'string', required: true},
          }
        }
      }
    }
  });
  t.is(validate2({a: {b: {c: 1, d: 'a'}}}), undefined);
  t.is(validate2({a: {b: null}}), undefined);
  t.deepEqual(validate2({a: {b: {}}}), [`Missing 'a.b.d'`]);
});

test(`Можно совмещать fields с другими вариантами типов, используя VType.Fields`, t => {
  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validate = validateObject({
    a: {
      type: ['string', VType.Int(), VType.Fields({ // ошибка выводится по последнему в списке типу.  Потому простые типы надо писать вперед
        b: {type: 'int'},
        c: {type: VType.String(), required: true},
      })]
    }
  });

  t.is(validate({a: 'test'}), undefined);
  t.is(validate({a: 12}), undefined);
  t.is(validate({a: {b: 12, c: 'test'}}), undefined);

  // Чтобы missing-сообщения были видно важно, чтобы сложный тип был последним в списке
  t.deepEqual(validate({a: {}}), [`Missing 'a.c'`]); // c or-валидаторами не понятно, как выводить детальные ошибки, если тип подошёл ...может вообще посто сокращать invalid ...а остальные оставлять?
});

test(`Можно добавить проверку элементов массива, и одновременно с этим использовать сабвалидаторы`, t => {

  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validate = validateObject({
    a: {
      type: VType.Array({ // в параметрах VType.Array задаем описание для элементов массива
        // required: ... в данном случае не учитывается, так как это не имеет в этом контексте смысла
        null: true, // элементы могут быть null
        type: [VType.Int(), VType.Fields({ // или одного из данных типов число или объект
          b: {type: VType.Int()},
          c: {type: VType.String(), required: true}, // при этом если это объект, то поле b обязательное
        }),]
      }).notEmpty() // как для других типов, указаываем дополнительные or-проверки.  Хотя конкретно notEmpty() можно реализовать сказав required: true, в описании типа элементов массива
    },
  });

  t.is(validate({a: [1, 2, 3]}), undefined);
  t.is(validate({a: [{b: 1, c: 'aaa'}, {c: 'bbb'}]}), undefined);
  t.is(validate({a: [null, 2, {c: 'bbb'}]}), undefined);

  // не массив
  t.deepEqual(validate({a: null}), [`Invalid 'a': null`]);
  t.deepEqual(validate({a: true}), [`Invalid 'a': true`]);
  t.deepEqual(validate({a: 12}), [`Invalid 'a': 12`]);
  t.deepEqual(validate({a: 'str'}), [`Invalid 'a': 'str'`]);
  t.deepEqual(validate({a: {}}), [`Invalid 'a': {}`]);

  // неверное значение в массиве
  t.deepEqual(validate({a: ['str', true, []]}), [`Invalid 'a[0]': 'str'`, `Invalid 'a[1]': true`, `Invalid 'a[2]': []`, ]);

  // массив пустой
  t.deepEqual(validate({a: []}), [`Invalid 'a' (reason: array is empty): []`]);

  // // объект, но нет обязательного поля
  t.deepEqual(validate({a: [{}, {b: 1}]}), [`Missing 'a[0].c'`, `Missing 'a[1].c'`]);

});

test(`Можно передать дополнительный валидатор как параметр VType.Object (для списка параметров)`, t => {

  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validate = validateObject({
    a: {type: VType.Object(v => hasOwnProperty.call(v, 'build') ? true : 'not a builder')},
  });

  t.is(validate({a: {build: function() {}}}), undefined);
  t.deepEqual(validate({a: {}}), [`Invalid 'a' (reason: not a builder): {}`]);
  t.deepEqual(validate({a: false}), [`Invalid 'a': false`]); // не объект
});

test.only(`возможность указывать кастомный валидатор в VType.Function`, t => {
  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validate = validateObject({
    n: {type: VType.Int(v => (2 <= v && v <= 4) ? true : `out of range`)},
    s: {type: VType.String((s => s.startsWith('#')))},
  });

  t.is(validate({n: 3, s: '# 123'}), undefined);
  t.deepEqual(validate({n: 0, s: 'wrong'}), [
    `Invalid 'n' (reason: out of range): 0`,
    `Invalid 's': 'wrong'`,
  ]);
});

test(`даже когда параметр validateExtends = false, но есть метод unexpectedFields - проверять все поля, включая поля из _extends`, t => {
  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validateParent = validateObject({
    _final: true,
    v1: {required: true, type: VType.String()},
  });

  const validate = validateObject({
    _extends: validateParent,
    _final: true, // TODO: Исправить название теста, после перехода на _final атрибут
    v2: {required: true, type: VType.String()},
  });
  t.is(validate({v1: 'str', v2: 'str'}), undefined);
  t.deepEqual(validate({v1: 'str', v2: 'str', v3: 'str'}), [`Unexpected 'v3': 'str'`]);
});

test(`сделать атрибут array`, t => {

  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validateA = validateObject({
    a: {array: {required: true, // не пустой массив
      fields: { // состоящий из объектов в плями
        b: {type: 'str', required: true},
        c: {type: 'int'},
      }
    }},
  });

  t.is(validateA({a: [{b: 'test', c: 12}, {b: 'str'}]}));
  t.deepEqual(validateA({a: [{c: 12}]}), [`Missing 'a[0].b'`]);
  t.deepEqual(validateA({a: []}), [`Invalid 'a' (reason: array is empty): []`]);

  const validateB = validateObject({
    b: {array: {type: 'int', validate: v => v > 3}} // массив из чисел больше трех, который может быть пустым
  });

  t.is(validateB({b: []}), undefined);
  t.is(validateB({b: [4, 5, 6]}), undefined);
  t.deepEqual(validateB({b: [2, 1, 0, -1, -2]}), [
    `Invalid 'b[0]': 2`,
    `Invalid 'b[1]': 1`,
    `Invalid 'b[2]': 0`,
    `...`,
  ]); // срабатывает ограничение на количество выдаваемых ошибок из массива

});

test.todo(`сделать атрибут map`); // проверяет что, как и для атрибута array, значения соотвествуют ограничениям + можно поставить ограничение на ключ, который всегда строка
test.todo(`сделать тип VType.map`);

// можно сделать рекурентные типы, для раскручивания вложенных подобных структур - непример tree у SchemaBuilder'а
// VType.Recurrent(type => VType.Object({type: VType.Fields({a: {type: type}});
// идея в том, что в качестве параметр передавать VType builder, который возвращает промежуточную функцию валидации, которая дальше использует внешнию функцию
// которую вернет через билдер метод
test.skip(`сделать рекурентный тип`, t => {
  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const validatorStruct = validateObject({
    v: {
      type: VType.Recurrent(type => // параметр это тип, который можно использовать в структуре или массиве, чтобы сделать структуру рекурентной
        VType.Fields({
          name: {type: String},
          children: {array: {type}}
        })),
    }
  });

  const validatorArray = validateObject({v: {type: VType.Recurrent(type => VType.Array({type: [VType.Int(), type]}))}});

  t.is(validatorArray({v: []}), undefined);
  t.is(validatorArray({v: [1, 2, 3]}), undefined);
  t.is(validatorArray({v: [1, [2, 3, [4, 5, 6]]]}), undefined);

  // TODO: Добавить в Recurrent субвалидатор, что минимум один уровень должен быть
  // TODO: Сделать чтоб тип, можно было отдавать перечнем ...или может сразу описание элемента, как для массива ...тогда полезно будет учитвать required - что один уровень обязательный
  // TODO: Щас типы можно использовать только при определении переменных ...а хочется recurrenct сделать на верхнем уро
});

test.skip(`валидация простыми типами`, t => {
  const typesExport = require('./types')._module();
  require('./typesBuiltIn').default(typesExport);
  const {VType} = typesExport;

  const method_v = VType.String(v => v.length > 3).name('v').build();
  t.is(method_v('1234'), undefined);

  validate.param('v', VType.String(v => v.length > 3).finished()); // выдавать предупреждение что для

  // 1. лучше билдер для проверки параметров сделать отдельным
  // 2. для структур, подумать над тем чтоб сделать спец. субвалидатор finished, который бы включал unexpectedFields \
  // 2a. или подумать о том, чтобы сделать отдельный тип VType.FinalFields, который бы не позволял использоваться его в extends ...


});

test.todo(`сделать проверку всех параметров метода`) // TODO: Подумать нужно ли и как сделать проверку опциональных позиционных параметров?!

test.todo(`_extends во вложенных структурах`); // почему бы ему не работать
