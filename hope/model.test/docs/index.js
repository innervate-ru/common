import fs from 'fs'
import path from 'path'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Загружает все исполняемые файлы из этой папки и вложенных папок на один уровень.  При этом имя документа (ключ) формируется путем объединения
 * имен вложенных папок и имени файла через точку.  Заргужаются только исполнимые файлы (то есть .md файлы будут проигнорированы).
 * Файлы и папки начинаюшиеся с точки или подчерка игнорируются.  При загрузке файла если есть свойство default, то проверяется если
 * default функция - он вызывается с параметром result
 */
export default function (result) {

  function loadLevel(items, code, dirname, level = 0, prefix = '') {
    fs.readdirSync(dirname)
      .filter(filename => !filename.startsWith('.') && !filename.startsWith('_') && (level > 0 || filename !== 'index.js'))
      .forEach(filename => {
        const fullpath = path.join(dirname, filename);
        let docName;
        if (fs.statSync(fullpath).isDirectory()) {
          try {

            const indexJs = path.join(fullpath, 'index.js'); // Если есть index.js, то это описание типа документа в папке
            fs.statSync(indexJs);

            const fullDocName = `${prefix}${filename}`  // prefix.substr(0, prefix.length - 1); // убираем точку в конце
            if (items.hasOwnProperty(fullDocName)) {
              result.context(Result.item(fullpath)).error(`dsc.duplicatedName`, {value: fullDocName});
            } else {
              try {
                let load = require(indexJs);
                if (typeof load === 'object' && load !== null && hasOwnProperty.call(load, 'default')) load = load.default;
                if (typeof load === 'function') load = load(result);
                items[fullDocName] = load;
              } catch (err) {
                console.error(err);
              }
            }

            try {
              const accessJs = path.join(fullpath, 'access.js');
              fs.statSync(accessJs);
              (code[fullDocName] || (code[fullDocName] = {})).access = accessJs;
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }

            try {
              const validateJs = path.join(fullpath, 'validate.js');
              fs.statSync(validateJs);
              (code[fullDocName] || (code[fullDocName] = {})).validate = validateJs;
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }

            try {
              const actionsJs = path.join(fullpath, 'actions.js');
              fs.statSync(actionsJs);
              (code[fullDocName] || (code[fullDocName] = {})).actions = actionsJs;
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
            }

          } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            loadLevel(items, code, fullpath, level + 1, `${prefix}${filename}.`);
          }
        } else if (docName = canBeRequire(filename)) {
          const fullDocName = `${prefix}${docName}`;
          if (items.hasOwnProperty(fullDocName)) {
            result.context(Result.item(fullpath)).error(`dsc.duplicatedName`, {value: fullDocName});
          } else {
            try {
              let load = require(fullpath);
              if (typeof load === 'object' && load !== null && hasOwnProperty.call(load, 'default')) load = load.default;
              if (typeof load === 'function') load = load(result);
              items[fullDocName] = load;
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
  }

  const items = {};
  const code = {};
  loadLevel(items, code, __dirname);

  return {items, code};
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
