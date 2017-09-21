import {VType, validateStructureFactory} from '../validation'

export const validateSchema = validateStructureFactory({
  gqlType: {type: VType.String()}, // query / mutation
  name: {type: VType.String().notEmpty(), required: true},
  procCall: {type: VType.String()},
  description: {type: VType.String()},
  params: {type: VType.Array({
    fields: {
      name: {type: VType.String(), required: true},
      type: {type: VType.String(), required: true},
      length: {type: VType.Int()},
      required: {type: VType.Boolean()},
      description: {type: VType.VString()},
    }
  })},
  result: {type: VType.Array({
    required: true,
    fields: {
      name: {type: VType.String(), required: true},
      type: {type: VType.String(), required: true},
      length: {type: VType.Int()},
      notNull: {type: VType.Boolean()},
      mssqlType: {type: VType.VString()},
      description: {type: VType.VString()},
    }
  })},
});
