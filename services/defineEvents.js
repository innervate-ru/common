import missingService from '../services/missingService'
import {missingArgument, invalidArgument} from '../utils/arguments'

import * as fs from 'fs'
import path from 'path'

const debug = require('debug')('load_events');

// TODO: Этот метод загрузки работает только если сервер лежит в исходном коде.  При переходе на сборку через webpack, нужно будет сделать плагин, который будет собирать файл в момент сборки проекта

export default function defineEvents(services = missingArgument('services')) {

  const {bus = missingService('bus')} = services;

  /**
   * Находит по указанному пути и во всех вложенных папках файлы с расширением .events.js, и с именем не начинающиеся с подчерка,
   * и вызывает default метод, с параметром services.
   *
   * Это позволяет выполнить все определения типов событий в проекте, вне зависимости от того запускается ли на данной ноде
   * сервис, который выдает эти событие.  Будет очень полезно, когда нод будет несколько и надо будет в том числе проверять
   * сообщения приходящие по шине от других нод.
   */
  return async function (rootPath = missingArgument('rootPath')) {

    debug('searching: %s', rootPath);

    let error, listCompleted;
    let directoriesInProcess = 0;
    const eventDefinitionFiles = [];

    const dirDone = () => {
      if (--directoriesInProcess === 0) listCompleted();
    };

    const processIfSubdir = (currentPath) => {
      fs.lstat(currentPath, function (err, stat) {
        if (err) {
          error = err;
          dirDone();
          return;
        }
        if (stat.isDirectory()) processDir(currentPath);
        dirDone();
      });
    };

    const processReaddirResult = (currentPath) => (err, files) => {
      if (err) {
        error = err;
        dirDone();
        return;
      }
      Array.prototype.push.apply(eventDefinitionFiles, files.filter(n => n.endsWith('.events.js') && !n.startsWith('_')).map(n => path.join(currentPath, n)));
      files.forEach(n => {
        if (n.startsWith('.') || n === 'node_modules') return; // это дополнительная защита.  правильно искать .event.js только в папке src
        directoriesInProcess++;
        processIfSubdir(path.join(currentPath, n));
      });
      dirDone();
    };

    const processDir = (currentPath) => {
      debug('processing dir: %s', currentPath);
      directoriesInProcess++;
      fs.readdir(currentPath, processReaddirResult(currentPath));
    };

    if (!(typeof rootPath === 'string')) invalidArgument('rootPath', rootPath);
    const listIsReady = new Promise(function (resolve, reject) {
      listCompleted = resolve;
    });
    processDir(rootPath); // запускает процесс сканирования директорий, который завершается когда счетчик directoriesInProcess становится ноль
    await listIsReady;
    eventDefinitionFiles.sort(); // сортируем, чтоб процесс загрузки был предсказуемым
    for (const filename of eventDefinitionFiles) {
      debug('loaded: %s', filename);
      const {'default': method} = require(filename);
      if (!(typeof method === 'function')) throw new Error(`${path.relative(process.cwd(), filename)}: 'default' export is not a method`);
      method(services);
    }
    bus.findUnmetAlterToString();
  }
};
