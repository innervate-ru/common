import {VType, validateEventFactory} from '../validation'

export default validateEventFactory({
  time: {type: VType.Int(), required: true},
  type: {type: VType.String().notEmpty(), required: true},
  source: {type: VType.String(), required: true, validate: v => /^[\w\:\-\_\/]+$/.test(v)},
});
