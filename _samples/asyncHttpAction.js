const MAX_ATTEMPTS = 3;
const ATTEMPTS_PERIOD = 3000;

/*async*/ function validate(doc, cancelPromise) {
  attempts = 0;
  return new Promise((resolve, reject) => {
    function validate() {
      cancelPromise.then(() => { '...' })
      // TODO:
      if (httpErr) {
        if (attempts++ < MAX_ATTEMPTS) {
          setTimeout(validate, ATTEMPTS_PERIOD)
        }
        resolve(false);
      } else if (ok) {
        resolve(true);
      } else {
        reject(result);
      }
    }
    validate();
  })
}
