import {VType} from '../validation'

export const errorSchema = {
  errorMessage: {type: VType.String().notEmpty(), required: true},
  errorStack: {type: VType.String().notEmpty()}, // стандартный call-stack из объекта Error, желательно, уменьшенный за счет выкидывания строк системного кода
  context: require('../context/context.schema').contextSchema,
};
