import {VType, validateThisServiceSettings, validate} from '../../validation/index'

export const process_args = validate.method.finished('args', {
  context: {type: VType.String()},
  postgres: {type: VType.Object(), required: true},
  silent: {type: VType.Boolean()},
  lock: {type: VType.Boolean()},
  dev: {type: VType.Boolean()},
  schemaDir: {type: VType.String().notEmpty()},
  codeDir: {type: VType.String().notEmpty()},
  _final: true,
});
