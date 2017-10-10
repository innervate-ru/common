import {VType, validate} from '../validation'

export const ctor_settings = validate.ctor.this({
  reuseResultTime: {type: VType.Int().zero().positive(), copy: true},
  reuseResultOnErrorTime: {type: VType.Int().zero().positive(), copy: true},
  maxParallelRequests: {type: VType.Int().zero().positive(), copy: true},
  now: {type: VType.Function(), copy: true}, // для тестирование - устаревший подход
});
