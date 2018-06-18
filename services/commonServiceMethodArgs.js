import {validate, VType} from '../validation'

export default validate.method.this('args', {
  context: {type: VType.Object()}, // контекст вызова, который добавляем метод ./serviceMethodWrapper
  _final: false,
});
