import {VType, validateThisServiceSettings, validate} from '../validation'

export const log_args = validate.method.this(undefined, {
  context: {type: VType.String()},
  error: {type: VType.Array(), required: true},
  _final: true,
});
