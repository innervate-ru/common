import {VType} from '../validation'

export const contextSchema = {
  type: VType.Fields({
    id: {required: true, type: VType.String().notEmpty()},
    stack: {
      required: true, type: VType.Array({
        type: [VType.String(), VType.Fields({ // стек вызовов сервисов. в стеке так же могут быть сообщения об ошибках передачи контекста, в виде строк
          svc: {required: true, type: VType.String().notEmpty()},
          method: {required: true, type: VType.String()},
          args: {type: VType.Object()},
        })],
      })
    }
  })
};
