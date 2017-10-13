import {VType, validateEventFactory} from '../validation'

export default validateEventFactory({
  timestamp: {type: VType.Int()}, // не required, так как подставляется автоматически в Bus.<log>()
  host: {type: VType.String()}, // не required, так как подставляется автоматически в Bus.<log>()
  message: {type: VType.String()},
  type: {type: VType.String().notEmpty(), required: true},
  source: {type: VType.String(), required: true, validate: v => /^[\w\:\-\_\/]+$/.test(v)},
});
