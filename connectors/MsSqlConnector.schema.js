import {
  validateAndCopyOptionsFactory,
  VType,
} from '../validation'

export const config = validateAndCopyOptionsFactory({
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

export const connectionMethodOptions = validateAndCopyOptionsFactory({
  cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
});

export const validateQueryMethodOptions = validateAndCopyOptionsFactory({
  params: {type: VType.Function()}, // функция, которой передается как аргумен tedious.Request, чтобы она через requies.addParameter могла заполнить параметры
  offset: {type: VType.Int().zero().positive()}, // строка, начиная с которой загружаются строки
  limit: {type: VType.Int().positive()}, // строка, до которой включительно загружаются строки
  context: {type: VType.String().notEmpty()}, // shortid контектса
});
