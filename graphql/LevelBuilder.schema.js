import {VType, validate} from '../validation'

export const ctor_options = validate.ctor.this({ // от этого класса наследуюется SchemaBuilder
  name: {type: VType.String().notEmpty(), copy: true},
  description: {type: VType.String(), copy: true},
});

export const validateFieldBuilder = validate.builder.method.finished({
  _extends: require('./TypeBuilder.schema').addField_field,
  typeDef: {null: true, type: VType.String()},
  resolver: {type: VType.Function(), validate: f => (2 <= f.length && f.length <= 3) ? true : `invalid arguments count`},
});
export const addQuery_query = validateFieldBuilder('query');
export const addMutation_mutation = validateFieldBuilder('mutation');

export const build_options = validate.method.finished('options', {
  _extends: require('./SchemaBuilder.schema').build_options,
  parentLevelBuilder: {type: VType.Object(), required: true},
  context: {type: VType.Object()},
});
