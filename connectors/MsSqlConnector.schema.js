import {VType, validate} from '../validation'

export const ctor_options = validate.ctor.finished({
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

export const connection_options = validate.method.finished('options', {
  cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
});

export const query_options = validate.method.finished('options', {
  params: {null: true, type: VType.Function()}, // функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
  offset: {null: true, type: VType.Int().zero().positive()}, // строка, начиная с которой загружаются строки
  limit: {null: true, type: VType.Int().positive()}, // сколько строк загружается
  context: {null: true, type: VType.String().notEmpty()}, // shortid контектса
});
