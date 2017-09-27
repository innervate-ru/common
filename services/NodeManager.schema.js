import {VType, validate} from '../validation'

const hasOwnProperty = Object.prototype.hasOwnProperty;

export const ctor_options = validate.ctor.finished({
  name: {required: true, type: VType.String(), copy: true},
  services: {type: VType.Array({type: VType.Object(), validate: s => hasOwnProperty.call(s, 'name') && hasOwnProperty.call(s, 'default') ? true : `not a Service builder`})},
});
