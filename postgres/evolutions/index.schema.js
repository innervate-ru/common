import {VType, validateThisServiceSettings, validate} from '../../validation/index'

export const process_args = validate.method.finished('args', {
  context: {type: VType.String()},
  // statement: {required: true, type: VType.String().notEmpty()},
  // params: {type: VType.Array()},
  _final: true,
});
