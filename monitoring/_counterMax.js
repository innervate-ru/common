export default function (name, options) {
  let max = 0;
  const counter = function (v) {
    if (typeof v === 'number') {
      if (v > max) {
        max = v;
      }
    }
  };
  counter.counterName = name;
  const get = counter.get = function () {
    return Math.round(max * 100) / 100; // точность до процента
  };
  counter.getAndReset = function () {
    let v = get();
    max = 0;
    return v;
  };
  return counter;
}
