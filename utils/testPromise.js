/**
 * Метод, возвращающий новый promise и методы корыми его можно перевести в состояния resolved или rejected.  Метод reject
 * обернут, чтобы его можно было вставлять в catch, и при этом результирующий promise тоже получал ошибку.
 */
export default function testPromise() {
  let resolve, reject;
  const promise = new Promise(function (_resolve, _reject) {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    promise, resolve, reject: (err) => {
      reject(err);
      return Promise.rejected(err);
    }
  };
}
