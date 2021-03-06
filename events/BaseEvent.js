import {VType, validateEventFactory} from '../validation'

export default validateEventFactory({
  context: {type: VType.String().notEmpty()}, // контекст не обязателен
  stack: {type: VType.String()}, // стек вызовов методов сервисов, при сообщении об ошибке
  timestamp: {type: VType.Int()}, // не required, так как подставляется автоматически в Bus.<log>()
  host: {type: VType.String()}, // не required, так как подставляется автоматически в Bus.<log>() - название хоста, на котором выполняется код
  node: {type: VType.String()}, // не required, так как подставляется автоматически в Bus.<log>() - название хоста, на котором выполняется код
  message: {type: VType.String()}, // поле, которое заполняется значение toString(), если оно указано для события
  type: {required: true, type: VType.String().notEmpty()}, // event, error, warning ...
  service: {required: true, type: VType.String(), validate: v => /^[\w\:\-\_\/\.]+$/.test(v)}, // название ноды и сервиса, через двоеточие
  _final: false,
});
