import {VType, validate} from '../../validation'

export const ctor_options = validate.ctor.finished({
  connector: {required: true, type: VType.String().notEmpty()},
});
