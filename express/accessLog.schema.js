import {VType, validate} from '../validation'

export const options = validate.method.finished('options', {
  service: {required: false, type: VType.String().notEmpty(), default: 'http'}, // имя сервиса, которое будет прописанно в graylog.  По умолчание 'http'
});
