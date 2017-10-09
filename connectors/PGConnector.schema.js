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

export const exec_args = validate.method.finished('args', {
  statement: {required: true, type: VType.String().notEmpty()},
  params: {type: VType.Array()},
});
