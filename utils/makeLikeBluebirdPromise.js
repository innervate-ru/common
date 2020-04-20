export default function makeLikeBluebirdPromise(promise) {
  if (promise.isFulfilled) return promise;
  let isFulfilled = false;
  let isRejected = false;
  let reason;
  let result = promise.then(
    function(v) { isFulfilled = true; return v; },
    function(e) { isRejected = true; reason = e; throw e; });
  result.isFulfilled = function() { return isFulfilled; }
  result.isRejected = function() { return isRejected; }
  result.reason = function() { return reason; }
  return result;
}
