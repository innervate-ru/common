import {VType, validate} from '../validation'

export const ctor_schemaTree = validate.method.finished('schemaTree', {
  schemaTree: {type: VType.Object()}, // TODO: Сделать рекурентную проверку дерева - VType.Recurrent
});

export const build_options = validate.method.finished('options', {
  typeDefs: {type: VType.Array(), required: true},
  resolvers: {type: VType.Object(), required: true},
});
