import {VType, validateAndCopyOptionsFactory, validateOptionsFactory} from '../validation'

export const TypeBuilderOptions = validateAndCopyOptionsFactory({
  name: {type: VType.String().notEmpty(), copy: true},
  isSchema: {type: VType.Boolean(), copy: true},
});

export const buildMethodOptions = validateOptionsFactory({
  name: {type: VType.String().notEmpty(), required: true},
  args: {type: [VType.String().notEmpty(), VType.Array().notEmptyAndOnlyStrings()]},
  type: {type: VType.String().notEmpty(), required: true},
});
