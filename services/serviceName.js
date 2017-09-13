import path from 'path'

const join = path.join(process.cwd(), '/services');

function removeExt(s) {
  const n = s.lastIndexOf('.');
  return s.substr(0, n);
}

/**
 * Возвращает элементы имени сервиса, в виде массива.
 *
 * Имя сервиса формируется на основе полного имени головоного файла.
 *
 * Имя включает в себя имена директорий внутри директории services.  Если сервис не находится в директории services, тогда
 * имя включает в себя все директории внутри src, если есть, или от корня проекта.
 *
 * Если файл сервис не index.js, то в конце имени сервиса идет название файла, без расширения.
 *
 * @param filename Путь файлу, взятые в исходном файле из константы __filename
 * @returns {Array} Имя сервиса в виде массива строк
 */
export default function serviceName(filename) {

  const r = path.relative(process.cwd(), filename);

  const s = r.split(/\/|\\/);

  if (s[s.length - 1] === 'index.js') s.pop(); // удаляем из имени index
  else s[s.length - 1] = removeExt(s[s.length - 1]); // для других файлов, убираем только расширение

  // удаляем из имени директории включая services.  это одинаково хорошо работает для сервисов в проекте и сервисов в папке common
  const n = s.indexOf('services');
  if (n !== -1) s.splice(0, n + 1);
  else {
    const n = s.indexOf('src');
    if (n !== -1) s.splice(0, n + 1);
  }
  return s.join('/');
}
