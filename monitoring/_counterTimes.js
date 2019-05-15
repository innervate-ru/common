export default function (serviceName, name) {
  const fixedName = serviceName.replace(/\//g, '_');
  let times = 0;
  const counter = function (v) {
    if (typeof v === 'number') {
      times += v;
    } else {
      times++;
    }
  };
  counter.counterName = `${fixedName}_${name}`;
  const initValue = counter.initValue = 0;
  const get = counter.get = function () {
    return times;
  };
  counter.getAndReset = function () {
    let v = get();
    times = initValue;
    return v;
  };
  return counter;
}
