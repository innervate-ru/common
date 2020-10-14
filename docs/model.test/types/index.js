import fs from 'fs'
import path from 'path'
import Result from '../../../result'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Загружает все исполняемые файлы из этой папки и вложенных папок на один уровень.  При этом имя документа (ключ) формируется путем объединения
 * имен вложенных папок и имени файла через точку.  Заргужаются только исполнимые файлы (то есть .md файлы будут проигнорированы).
 * Файлы и папки начинаюшиеся с точки или подчерка игнорируются.  При загрузке файла если есть свойство default, то проверяется если
 * default функция - он вызывается с параметром result
 */
export default function (result) {

  function loadLevel(res, dirname, level = 0, prefix = '') {
    fs.readdirSync(dirname)
      .filter(filename => !filename.startsWith('.') && !filename.startsWith('_') && (level > 0 || filename !== 'index.js'))
      .forEach(filename => {
        const fullpath = path.join(dirname, filename);
        let docName;
        if (fs.statSync(fullpath).isDirectory()) {
          loadLevel(res, fullpath, level + 1, `${prefix}${filename}.`);
        } else if (docName = canBeRequire(filename)) {
          const fullDocName = `${prefix}${docName}`;
          if (res.hasOwnProperty(fullDocName)) {
            result.error(() => dirname, `dsc.duplicatedName`, {value: fullDocName});
          } else {
            try {
              let load = require(fullpath);
              if (typeof load === 'object' && load !== null && hasOwnProperty.call(load, 'default')) load = load.default;
              if (typeof load === 'function') load = load(result);
              res[fullDocName] = load;
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
  }

  const res = {};
  loadLevel(res, path.resolve(process.cwd(), 'src/common/docs/types'));
  // loadLevel(res, __dirname);
  return res;
}

/**
 * Проверяем может ли файл быть зарружен через require.  Проверяем от самого длинного расширения к более короткому  Например: для
 * test.js.md сперва проверяет js.md, а потом .md.  Если файл может быть загружен, возвращает его name без найденного длинного
 * расширения. В отличии от path.parse(`go.on.js.md`).name, который возвращает go.on.js, будет возвращено
 * go.on
 */
export function canBeRequire(filename) {
  let i, ext = filename;
  while ((i = ext.indexOf('.', 1)) > 0) {
    ext = ext.substr(i);
    if (hasOwnProperty.call(require.extensions, ext)) return filename.substr(0, filename.length - ext.length);
  }
}
