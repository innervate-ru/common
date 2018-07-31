import {VType, validate} from '../../common/validation'

export const ctor_options = validate.ctor.this({
  url: {copy: true, required: true, type: VType.String().notEmpty()},
  debug: {copy: true, type: VType.Boolean(), default: false},
  _final: true,
});
