import {VType, validate} from '../validation'

const hasOwnProperty = Object.prototype.hasOwnProperty;

export const ctor_settings = validate.service.finished({
  description: {type: VType.String()},
  url: {type: VType.String().notEmpty(), required: true},
  user: {type: VType.String().notEmpty(), required: true},
  password: {type: VType.String().notEmpty(), required: true},
  options: {
    fields: {
      appName: {type: VType.String().notEmpty()},
      debug: {type: VType.Int()},
      port: {type: VType.Int()},
      database: {type: VType.String().notEmpty(), required: true},
    },
  },
  poolConfig: {
    fields: {
      min: {type: VType.Int().positive()},
      max: {type: VType.Int().positive()},
      log: {type: VType.Boolean()},
      idleTimeout: {type: VType.Int().positive()},
      retryDelay: {type: VType.Int().positive()},
      acquireTimeout: {type: VType.Int().positive()},
    },
  },
});

export const connection_args = validate.method.this('args', {
  cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
});

export const exec_args = validate.method.finished('options', {
  _extends: connection_args,
  query: {type: VType.String()}, // SQL запрос, который должен быть выполнен
  procedure: {type: VType.String()}, // хранимая процедура, которую надо вызвать
  paramDef: {null: true, type: VType.Object()},
  // paramsDef: {null: true, type: [VType.String(), VType.Fields({ // типы параметров.  не обязательные к заполнения // TODO: Сделать проверку что все значения map это строки из возможных вариантом параметров
  //   // TODO: Расписать, что может быть в атрибутах, когда сделаю тип VType.map
  // })]},
  params: {null: true, type: VType.Object()}, // значения параметров в виде map'а
  offset: {null: true, type: VType.Int().zero().positive()}, // строка, начиная с которой загружаются строки
  limit: {null: true, type: VType.Int().positive()}, // сколько строк загружается
  context: {null: true, type: VType.String().notEmpty()}, // shortid контектса
  _validate: (context, value, message, validateOptions) => {
    let cnt = 0;
    if (hasOwnProperty.call(value, 'query')) ++cnt;
    if (hasOwnProperty.call(value, 'procedure')) ++cnt;
    if (!(cnt === 1)) (message || (message = [])).push(`Either 'query' or 'procedure' must be specified, but not both`);
    return message;
  }
});
