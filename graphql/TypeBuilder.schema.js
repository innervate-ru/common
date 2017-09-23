import {VType, validate} from '../validation'

export const ctor_options = validate.ctor.finished({
  name: {required: true, type: VType.String().notEmpty(), copy: true},
  description: {type: VType.String(), null: true, copy: true},
  isSchema: {type: VType.Boolean(), copy: true},
});

export const addField_field = validate.method.this(`field`, { // в этот метод могут приходить расширенные структры данных от LevelBuilder'а
  description: {null: true, type: VType.String()},
  name: {required: true, type: VType.String().notEmpty()},
  args: {null: true, type: [VType.String().notEmpty(), VType.Array({ // строка
    type: [VType.String(), VType.Fields({                // массив строк
      name: {type: VType.String(), required: true},      // массив структур
      type: {type: VType.String(), required: true},
      description: {type: VType.String()},
    })]
  }).notEmpty()]},
  type: {required: true, type: VType.String().notEmpty()},
});
