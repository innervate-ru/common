import {validate, VType} from "../validation";

export const args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  auth: {type: VType.Function()},
  path: {type: VType.String().notEmpty(), required: true}, // post http путь
  method: {type: VType.Function(), required: true}, // вызываемый метод
  result: {type: VType.Boolean()},
  _final: true,
});
