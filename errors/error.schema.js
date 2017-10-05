import {VType} from '../validation'

export const errorSchema = {
  message: {type: VType.String().notEmpty(), required: true},
  stack: {type: VType.String().notEmpty()}, // стандартный call-stack из объекта Error, желательно, уменьшенный за счет выкидывания строк системного кода
  context: require('../context/context.schema').contextSchema,
};
