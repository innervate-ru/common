import {validate, VType} from "../validation";

export const args = validate.method.this('args', {
  result: {type: VType.Boolean()},
  name: {type: VType.String()},
  http: {type: VType.Boolean()},
  _final: true,
});
