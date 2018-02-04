import {VType} from '../validation'

// это схема для event'ов.  в аргументах context передается просто как строка
export const contextSchema = {
  type: VType.Fields({
    id: {required: true, type: VType.String().notEmpty()},
    stack: {
      required: true, type: VType.Array({
        type: [VType.String(), VType.Fields({ // стек вызовов сервисов. в стеке так же могут быть сообщения об ошибках передачи контекста, в виде строк
          service: {required: true, type: VType.String().notEmpty()},
          method: {required: true, type: VType.String()},
          args: {type: VType.Object()},
        })],
      })
    }
  })
};
