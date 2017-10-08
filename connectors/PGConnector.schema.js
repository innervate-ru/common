import {VType, validate} from '../validation'

export const ctor_settings = validate.service.finished({
  description: {type: VType.String()},
  url: {type: VType.String().notEmpty(), required: true},
  port: {type: VType.Int()},
  user: {type: VType.String().notEmpty(), required: true},
  password: {type: VType.String().notEmpty(), required: true},
  database: {type: VType.String().notEmpty(), required: true},
  max: {type: VType.Int().positive()},
  idleTimeoutMillis: {type: VType.Int().positive()},
  // TODO: Посмотреть в код pg, выписать все опции
});

// TODO: Impl
// export const connectionMethodOptions = validateAndCopyOptionsFactory({
//   cancel: {type: VType.Promise()}, // promise, который если становится resolved, то прерывает выполнение запроса
// });

