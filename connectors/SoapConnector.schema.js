import {
  validateAndCopyOptionsFactory,
  VType,
} from '../validation'

export const config = validateAndCopyOptionsFactory({
  stop: {type: VType.Boolean()},
  description: {type: VType.String()},
  uri: {type: VType.String().notEmpty(), required: true/*, copy: true*/},
  login: {type: VType.String().notEmpty(), required: false/*, copy: true*/},
  password: {type: VType.String().notEmpty(), required: false, copy: true},
});
