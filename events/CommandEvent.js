import {VType, validateEventFactory} from '../validation'
import BaseEvent from './BaseEvent'

export default validateEventFactory({
  _extends: BaseEvent,
  target: {type: VType.String().notEmpty(), required: true}, // TODO: Add 'target' validation
});
