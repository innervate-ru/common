import {VType, validate} from '../validation'

// TODO: не работает проверка правильности названия канала, надо разобраться
const postgresChannelName = v => { return /^[a-z0-9_]+$/.test(v) ? true : 'invalid postgres channel name'; }; // Тут важно вернуть через return.  Если без return и скобок, то в ES6 возвращает всегда true

export const ctor_settings = validate.service.finished({
  context: {type: VType.String()},
  description: {type: VType.String()},
  host: {type: VType.String().notEmpty(), required: true},
  port: {type: VType.Int()},
  user: {type: VType.String().notEmpty(), required: true},
  password: {type: VType.String().notEmpty(), required: true},
  database: {type: VType.String().notEmpty(), required: true},
  max: {type: VType.Int().positive()},
  idleTimeoutMillis: {type: VType.Int().positive()},
  // TODO: Посмотреть в код pg, выписать все опции

  debugWithFakeTimer: {type: VType.Boolean()},
});

export const exec_args = validate.method.finished('args', {
  context: {type: VType.String()},
  statement: {required: true, type: VType.String().notEmpty()},
  params: {type: VType.Array()},
  _final: true,
});

export const sendMessage_args = validate.method.finished('args', {
  context: {type: VType.String()},
  channel: {required: true, type: VType.String(), validate: postgresChannelName},
  message: {required: true, type: [VType.String(), VType.Object()]},
  _final: true,
});

export const onNotification_args = validate.method.finished('args', {
  context: {type: VType.String()},
  channel: {required: true, type: VType.String(), validate: postgresChannelName},
  handler: {required: true, type: VType.Function()},
  parseJSON: {type: VType.Boolean()},
  _final: true,
});
