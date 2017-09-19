import {VType, validateAndCopyOptionsFactory, validateOptionsFactory} from '../validation'

export const LevelBuilderOptions = validateAndCopyOptionsFactory({
  name: {type: VType.String().notEmpty(), copy: true},
});

export const addBuilderOptions = validateOptionsFactory({
  builder: {type: [VType.Function(), VType.Object()], required: true}, // TODO: Add validator for type Object
});

export const addFieldOptions = validateOptionsFactory({
  name: {type: VType.String().notEmpty(), required: true},
  args: {type: [VType.String().notEmpty(), VType.Array().notEmptyAndOnlyStrings()]},
  type: {type: VType.String().notEmpty(), required: true},
  typeDef: {type: VType.String().notEmpty()},
  resolver: {type: VType.Function()},
});

export const SchemaBuilderBuildMethodOptions = validateOptionsFactory({
  typeDefs: {type: VType.Array(), required: true},
  resolvers: {type: VType.Object(), required: true},
});

export const LevelBuilderBuildMethodOptions = validateOptionsFactory({
  _extends: SchemaBuilderBuildMethodOptions,
  parentLevelBuilder: {type: VType.Object(), required: true},
  context: {type: VType.Object()},
});
