import {VType, validate} from '../../validation'

export const ctor_settings = validate.service.finished({
  _extends: require('../../services/Service.schema').ctor_settings,
  connector: {required: true, type: VType.String().notEmpty()},
});
