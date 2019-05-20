import { VType, validate } from '../validation/index';

export const ctor_options = validate.ctor.this({
  key: { required: true, type: VType.String()},
  countersResetPeriod: { required: true, type: VType.Int()},
});

export const addLabelFunction_args = validate.method.this('args', {
  name: {required: true, type: VType.String().notEmpty()}, // название метки
  value: {type: VType.String().notEmpty(), default: undefined}, // значение метки, или undefined (null) чтобы удалить метку
});

export const addServiceFunction_args = validate.method.this('args', {
  serviceName: {required: true, type: VType.String().notEmpty()}, // имя сервис, к которму относится счетчик
});

export const addCounterFunction_args = validate.method.this('args', {
  serviceName: {required: true, type: VType.String().notEmpty()}, // имя сервис, к которму относится счетчик
  name: {required: true, type: VType.String().notEmpty()}, // название счетчика в snake-формате, полное название счетчика будет <имя сервиса>_<имя счетчика>
  type: {required: true, type: VType.String().notEmpty()}, // тип счётчика, times, sum, avg ...
  value: {type: VType.Any()}, // начальное значение, используется для type: 'value'
});
