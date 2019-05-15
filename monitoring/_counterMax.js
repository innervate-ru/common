export default function (serviceName, name) {
  const fixedName = serviceName.replace(/\//g, '_');
  let max = 0;
  const counter = function (v) {
    if (typeof v === 'number') {
      if (v > max) {
        max = v;
      }
    }
  };
  counter.counterName = `${fixedName}_${name}`;
  const initValue = counter.initValue = 0;
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
