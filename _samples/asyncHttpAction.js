const MAX_ATTEMPTS = 3;
const ATTEMPTS_PERIOD = 3000;

/*async*/ function validate(doc, cancelPromise) {
  attempts = 0;
  return new Promise((resolve, reject) => {
    function val() {
      cancelPromise.then(() => { '...' })
      // TODO:
      if (httpErr) {
        if (attempts++ < MAX_ATTEMPTS) {
          setTimeout(val, ATTEMPTS_PERIOD)
        }
        reject(httpErr);
      } else if (ok) {
        resolve(true);
      } else {
        resolve(result);
      }
    }
    val();
  })
}
