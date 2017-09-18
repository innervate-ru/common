import path from 'path'

/**
 * Возвращает префикс для типов graphql, как строку разделенную подчерками.
 *
 * Префикс формируется на основе полного имени директории в которой находится файл.
 *
 * Имя включает в себя имена директорий внутри директории services.  Если сервис не находится в директории services, тогда
 * имя включает в себя все директории внутри src, если есть, или от корня проекта.
 *
 * @param dirname Путь файлу, взятые в исходном файле из константы __dirname
 * @returns {String} Префик для типов в виде строки, окончивающейся подчерком
 */
export default function typePrefix(dirname) {

  const r = path.relative(process.cwd(), dirname);

  const s = r.split(/\/|\\/);

  // удаляем из имени директории включая services.  это одинаково хорошо работает для сервисов в проекте и сервисов в папке common
  const n = s.indexOf('services');
  if (n !== -1) s.splice(0, n + 1);
  else {
    const n = s.indexOf('src');
    if (n !== -1) s.splice(0, n + 1);
  }
  return `${s.join('_')}_`;
}
