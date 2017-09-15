import {VType, validateAndCopyOptionsFactory} from '../validation'

export const nodeManagerClassOptions = validateAndCopyOptionsFactory({
  name: {type: VType.String(), required: true, copy: true},
  services: {type: VType.Array()},
});

