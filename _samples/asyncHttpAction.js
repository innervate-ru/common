const MAX_ATTEMPTS = 3;
const ATTEMPTS_PERIOD = 3000;

/*async*/ function validate(doc, cancelPromise) {
  let attempts = 0;
  let timer;
  return new Promise((resolve, reject) => {
    function val() {
      cancelPromise.then(() => {
        clearTimeout(timer);
        // TODO:
      });
      // TODO:
      if (httpErr) {
        if (attempts++ < MAX_ATTEMPTS) {
          timer = setTimeout(val, ATTEMPTS_PERIOD)
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
