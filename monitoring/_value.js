export default function (name, options) {
  let value = options && options.value;
  const counter = function (v) {
    value = v;
  };
  counter.counterName = name;
  const get = counter.get = function () {
    return value;
  };
  counter.getAndReset = function () {
    return get; // возвращает функцию, которая возвращает текущее значение.  так что счетчики 'value' показывают значение без задержки на период
  };
  return counter;
}
