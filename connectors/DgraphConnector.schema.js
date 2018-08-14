import {VType, validate} from '../../common/validation'

export const ctor_options = validate.ctor.this({
  stop: {type: VType.Boolean()},
  url: {copy: true, required: true, type: VType.String().notEmpty()},
  debug: {copy: true, type: VType.Boolean(), default: false},
  _final: false,
});
