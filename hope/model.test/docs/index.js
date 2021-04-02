import fs from 'fs'
import path from 'path'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Загружает все исполняемые файлы из этой папки и вложенных папок на один уровень.  При этом имя документа (ключ) формируется путем объединения
 * имен вложенных папок и имени файла через точку.  Заргужаются только исполняемые файлы (то есть .md файлы будут проигнорированы).
 * Файлы и папки начинаюшиеся с точки или подчерка игнорируются.  При загрузке файла если есть свойство default, то проверяется если
 * default функция - он вызывается с параметром result
 */
export default function (result) {

  class Level {

    constructor(fullname) {
      this.filename = null;
      this.basedir = fullname;
    }

    fileExists(filename) {
      this.filename = null;
      return ['.js', '.coffee'].some(fileext => {
        try {
          const fullname = path.join(this.basedir, `${filename}${fileext}`);
          if (!fs.statSync(fullname).isFile()) return false;
          this.filename = fullname;
          return true;
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
      });
    }

    loadFile(filename) {
      let load = require(filename || this.filename);
      if (typeof load === 'object' && load !== null && hasOwnProperty.call(load, 'default')) load = load.default;
      if (typeof load === 'function') load = load(result);
      return load;
    }

    dirExists(dirname) {
      try {
        const fullname = path.join(this.basedir, dirname);
        return fs.statSync(fullname).isDirectory();
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      return false;
    }
  }

  function loadLevel(items, code, dirname, level = 0, prefix = 'doc.') {

    fs.readdirSync(dirname)
      .filter(filename => !filename.startsWith('.') && !filename.startsWith('_') && (level > 0 || (filename !== 'index.js' && filename !== 'rights.js')))
      .forEach(filename => {
        const fullpath = path.join(dirname, filename);
        let docName;
        if (fs.statSync(fullpath).isDirectory()) {

          const dirLevel = new Level(fullpath);

          if (dirLevel.fileExists('index')) { // версия 2: все поля, states и actions decl в одном index.js

            const fullDocName = `${prefix}${filename}`  // prefix.substr(0, prefix.length - 1); // убираем точку в конце
            if (items.hasOwnProperty(fullDocName)) {
              result.error(() => fullpath, `dsc.duplicatedName`, {value: fullDocName});
              return;
            }
            items[fullDocName] = dirLevel.loadFile();

            if (dirLevel.fileExists('access')) {
              (code[fullDocName] || (code[fullDocName] = {})).access = dirLevel.filename;
            }

            if (dirLevel.fileExists('validate')) {
              (code[fullDocName] || (code[fullDocName] = {})).validate = dirLevel.filename;
            }

            if (dirLevel.fileExists('actions')) {
              ((code[fullDocName] || (code[fullDocName] = {})).actions = {}).default = dirLevel.filename;
            }

          } else if (dirLevel.fileExists('fields')) { // версия 3: поля, actions, states в отдельных фпйлах. не system actions отдельной папке вместе с declaration + rights + computed

            const fullDocName = `${prefix}${filename}`  // prefix.substr(0, prefix.length - 1); // убираем точку в конце
            if (items.hasOwnProperty(fullDocName)) {
              result.error(() => fullpath, `dsc.duplicatedName`, {value: fullDocName});
              return;
            }

            const doc = items[fullDocName] = {};

            doc.fields = dirLevel.loadFile();

            if (dirLevel.fileExists('states')) {
              doc.states = dirLevel.loadFile();
            }

            if (dirLevel.fileExists('computed')) {
              (code[fullDocName] || (code[fullDocName] = {})).computed = dirLevel.filename;
            }

            if (dirLevel.fileExists('access')) {
              (code[fullDocName] || (code[fullDocName] = {})).access = dirLevel.filename;
            }

            if (dirLevel.fileExists('rights')) {
              (code[fullDocName] || (code[fullDocName] = {})).rights = dirLevel.filename;
            }

            if (dirLevel.fileExists('validate')) {
              (code[fullDocName] || (code[fullDocName] = {})).validate = dirLevel.filename;
            }

            const actions = (code[fullDocName] || (code[fullDocName] = {})).actions = {};
            if (dirLevel.fileExists('systemActions')) {
              actions.default = dirLevel.filename;
            }

            if (dirLevel.dirExists('actions')) {

              const actionsLevel = new Level(path.join(dirLevel.basedir, 'actions'));
              fs.readdirSync(actionsLevel.basedir)
                .filter(filename => !filename.startsWith('.') && !filename.startsWith('_'))
                .forEach(filename => {
                  const actionFile = path.join(actionsLevel.basedir, filename);
                  const actionDesc = require(actionFile);
                  const actionName = path.parse(filename).name;
                  if (actionDesc.hasOwnProperty('model')) { // есть описание action
                    (doc.actions || (doc.actions = {}))[actionName] = actionDesc.model;
                  }
                  if (actionDesc.hasOwnProperty('default')) { // есть реализпция action
                    if (!doc.actions[actionName]) {
                      result.error(() => filename, `dsc.missingActionModel`, {value: actionName});
                      return;
                    }
                    actions[actionName] = actionFile;
                  }
                });
            }
          } else  {

            if (fs.statSync(fullpath).isDirectory()) {

              loadLevel(items, code, fullpath, level + 1, `${filename}.`);
            }
          }
        } else if (docName = canBeRequire(filename)) { // версия 1: описание документа просто в <тип документа>.js

          const fullDocName = `${prefix}${docName}`;
          if (items.hasOwnProperty(fullDocName)) {
            result.error(() => fullpath, `dsc.duplicatedName`, {value: fullDocName});
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

  const docsRoot = new Level(__dirname);
  if (docsRoot.fileExists('rights')) {
    code.rights = docsRoot.filename;
  }

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
