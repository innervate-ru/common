import {VType, validateThisServiceSettings, validate} from '../validation';

export const ctor_settings = validateThisServiceSettings({
  expirationPeriod: {type: VType.Int().positive(), required: true}, // Основное время активности токена в СЕК
  extraTime: {type: VType.Int().positive(), required: true}, // Дополнительное время активности в СЕК
});

export const signToken_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  token: {type: VType.Object(), required: true},
  nonExpiring: {type: VType.Boolean()},
});

export const parseToken_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  token: {type: VType.String(), required: true},
  isExpiredOk: {type: VType.Boolean()},
});

export const newSession_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  sessionId: {type: VType.String().notEmpty()},
  userIp: {type: VType.String()},
  isTestToken: {type: VType.Boolean()},
  _final: true,
});

export const extendSession_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  session: {type: VType.String(), required: true},
  userIp: {type: VType.String(), required: true},
  user: {type: VType.Object(), null: true},
  _final: true,
});

export const login_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  userEmail: {type: VType.String(), required: true},
  user: {type: VType.String(), required: true},
  _final: true,
});

export const logout_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  _final: true,
});

export const longToken_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  creditOrgId: {type: VType.String().notEmpty()},
  name: {type: VType.String().notEmpty(), required: true},
  notes: {type: VType.String()},
  _final: true,
});

export const middleware_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  expressApp: {type: VType.Function(), required: true, validate: v => ('post' in v) || 'not express.js app'},
});

export const addUpdateUser_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  updateUserHandler: {type: VType.Function(), required: true},
  _final: true,
});
