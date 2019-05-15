export default function (serviceName, name) {
  const fixedName = serviceName.replace(/\//g, '_');
  let times = 0;
  let startTime = Date.now();
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
    const step = Date.now() - startTime
    const v = times * 60 * 1000 / step; // количество событий в минуту
    return Math.round(v * 100) / 100; // точность до процента
  };
  counter.getAndReset = function () {
    let v = get();
    times = initValue;
    startTime = Date.now();
    return v;
  };
  return counter;
}
