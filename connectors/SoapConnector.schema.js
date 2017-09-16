import {
  validateAndCopyOptionsFactory,
  VType,
} from '../validation'

export const config = validateAndCopyOptionsFactory({
  description: {type: VType.String()},
  uri: {type: VType.String().notEmpty(), required: true/*, copy: true*/},
  login: {type: VType.String().notEmpty(), required: true/*, copy: true*/},
  password: {type: VType.String().notEmpty(), required: true, copy: true},
});
