import {validate, VType} from "../validation";

export const args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  expressApp: {type: VType.Function(), required: true, validate: v => ('post' in v) || 'not express.js app'},
  auth: {type: VType.Function(), null: true},
  path: {type: VType.String().notEmpty(), required: true}, // post http путь
  service: {type: VType.Object(), required: true, validate: v => v.hasOwnProperty('_service') || `not a service`}, // вызываемый метод
  method: {type: VType.Function(), required: true}, // вызываемый метод
  result: {type: VType.Boolean()},
  http: {type: VType.Boolean()},
  _final: true,
});
