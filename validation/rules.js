import {messageInvalidFieldValue} from './validateObject'

export const validateNonEmptyString = (fieldName, fieldDef) => {
  return (value, message, validateOptions) => {
    if (value[fieldName].length > 0) return;
    (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
    return message;
  }
};

export const validateZeroOrPositiveInt = (fieldName, fieldDef) => {
  return (value, message, validateOptions) => {
    if (value[fieldName] >= 0) return;
    (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
    return message;
  }
};

export const validatePositiveInt = (fieldName, fieldDef) => {
  return (value, message, validateOptions) => {
    if (value[fieldName] > 0) return;
    (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
    return message;
  }
};

export const validatePromise = (fieldName, fieldDef) => {
  return (value, message, validateOptions) => {
    if ('then' in value[fieldName]) return;
    (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
    return message;
  }
};

export const validateArrayOfString = (fieldName, fieldDef) => {
  return (value, message, validateOptions) => {
    const v = value[fieldName];
    for (const item of v)
      if (!(typeof item === 'string')) {
        (message || (message = [])).push(messageInvalidFieldValue(value, fieldName));
        return message;
      }
  }
};
