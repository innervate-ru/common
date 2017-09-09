import {validateEventFactory, messageInvalidFieldValue} from '../validation/validateObject'
import {validateNonEmptyString} from '../validation'
export {default as Bus} from './bus'
export {VType} from '../validation'

export const validateEvent = validateEventFactory({
  time: {type: 'int', required: true},
  type: {type: 'string', required: true, validate: validateNonEmptyString},
});

export const validateServiceEvent = validateEventFactory({
  _extends: validateEvent,
  source: {type: 'string', required: true, validate: (fieldName, fieldDef) => (value, message, validateOptions) => {
    if (/^[\w\:]+$/.test(value[fieldName])) return;
    (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
    return message;
  }},
});

export const validateServiceCommandEvent = validateEventFactory({
  _extends: validateServiceEvent,
  target: {type: 'object', required: true, validate: (fieldName, fieldDef) => function(object, message, options) {
    // TODO: Add 'target' validation
  }},
});


