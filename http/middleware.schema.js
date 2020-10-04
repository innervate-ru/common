import {validate, VType} from "../validation";

export const args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  expressApp: {type: VType.Function(), required: true, validate: v => ('post' in v) || 'not express.js app'},
  _final: true,
});
