import throwIfMissing from 'throw-if-missing'
import prettyPrint from './prettyPrint'
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * По опыту RMS, полезно обращаться к свойствам не напрямую а через методы get и set, которые проверяют правильность имени
 * свойтсва.  Если такого имени нет - выбрасываются исключение.
 *
 * Чтобы это получить, надо задавать свойства через метод defineProps, а не напрямую через Object.defineProperties.
 *
 * Прим.: Это очень примитивная реализация этой идеи.  Если пойдет, то надо:
 * 1. Поддержать работу со свойствами классами предками
 * 2. Разрулить, чтобы у метода не было других get и set методов
 */
export default function defineProps(clazz = throwIfMissing('clazz'), props = throwIfMissing('props')) {
  if (!(typeof clazz === 'function' && clazz !== null && !Array.isArray(clazz) && hasOwnProperty.call(clazz, 'prototype')))
    throw new Error(`Invalid argument 'clazz': ${prettyPrint(clazz)}`);
  if (!(typeof props === 'object' && props !== null && !Array.isArray(props)))
    throw new Error(`Invalid argument 'props': ${prettyPrint(props)}`);
  // TODO: Add parent props support

  clazz.prototype.get = function (name) {
    if (!hasOwnProperty.call(props, name)) throw new Error(`Missing property '${name}' in object '${prettyPrint(this)}'`);
    return this[name];
  };

  clazz.prototype.set = function (name) {
    if (!hasOwnProperty.call(props, name)) throw new Error(`Missing property '${name}' in object '${prettyPrint(this)}'`);
    return this[name].apply(this, arguments);
  };

  Object.defineProperties(clazz.prototype, props);
}
