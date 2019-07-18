export default function (name, options) {
  let times = 0;
  const counter = function (v) {
    if (typeof v === 'number') {
      times += v;
    } else {
      times++;
    }
  };
  counter.counterName = name;
  const get = counter.get = function () {
    return times;
  };
  counter.getAndReset = function () {
    let v = get();
    times = 0;
    return v;
  };
  return counter;
}
