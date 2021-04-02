import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import chalk from 'chalk'
import debounce from 'lodash/debounce'

import {Task} from '../../build/index'
import {compareStructures, i18n, Reporter, utils} from '../../../../../lib/hope/lib/index'

const TAB = 2;

export default function ({fromDir = 'model', toDir = 'data'} = {}) {

  const toDirRel = path.relative(__dirname, path.join(process.cwd(), fromDir, toDir));

  return new Task({
    name: `Compile from '${fromDir}/' to '${toDir}/model'`,
    async run() {
      try {

        deleteRequireCache(require.resolve('../../../../../lib/hope/lib'));

        const {loader: DSCLoader, config: DSCConfig} = require('../../../../../lib/hope/lib/index');

        const MAX_MESSAGES = 30;

        class ReporterImpl extends Reporter {
          _print(type, msg) {

            if (this.messages > MAX_MESSAGES) {
              if (this.messages === (MAX_MESSAGES + 1)) console.warn('...');
              return;
            }

            switch (type) {
              case 'error': {
                console.error(chalk.red(msg));
                break;
              }
              case 'warn': {
                console.warn(chalk.yellow(msg));
                break;
              }
              case 'info': {
                console.info(chalk.green(msg));
                break;
              }
            }
          }
        }

        const nonLocalResult = new ReporterImpl();
        const messages = DSCConfig.messages(nonLocalResult);
        if (nonLocalResult.isError) return;

        const result = new ReporterImpl(messages);

        const model = await DSCLoader(result, path.join(process.cwd(), fromDir));

        const hasRights = model.hasOwnProperty('rights');

        const hasValidators = model.hasOwnProperty('validators');

        const config = result.isError || DSCConfig.compile(result, {
          ...model,
          docs: model.docs.items,
          api: model.api && model.api.items
        });

        // add computed fields

        config.docs.$$list.forEach(docDesc => {

          const computed = docDesc.fields.$$tags.computed;
          const docCode = model.docs.code[docDesc.name];

          if (!computed) {
            if (docCode?.computed) {
              result.error('dsc.unexpectedComputedJS', {
                doc: docDesc.name,
                file: path.relative(process.cwd(), docCode.computed).replace(/\\/g, '/')
              });
            }
            return;
          }

          if (!docCode?.computed) {
            result.error('dsc.missingComputedJS', {
              doc: docDesc.name,
            });
            return;
          }

          // 1. check for inner computed
          if (computed) {
            for (let i = 0; i < docDesc.fields.$$flat.$$list.length; i++) {

              const field = docDesc.fields.$$flat.$$list[i];
              if (field.$$mask && computed.get(field.$$index)) {

                const subFields = computed.clone().and(field.$$mask);
                if (!subFields.isEmpty()) {
                  subFields.list.forEach(field => {

                    result.error('dsc.computedFieldWithinComputedField', {
                      doc: docDesc.name,
                      field: field.fullname || field.name,
                    });
                  });
                  i += field.fields.length;
                }
              }
            }
            if (result.isError) return;
          }

          // 2. find computed code
          const computedCode = require(docCode.computed).default?.({}); // services === {}
          const docFields = docDesc.fields;
          Object.entries(computedCode).forEach(([fieldName, fieldCode]) => {

            const fieldDesc = docFields.$$flat[fieldName];
            if (!fieldDesc) {
              result.error('dsc.unknownFieldInComputedCode', {
                doc: docDesc.name,
                field: fieldDesc.fullname || fieldDesc.name,
                file: path.relative(process.cwd(), docCode.computed).replace(/\\/g, '/')
              });
              return;
            }

            if (!computed?.get(fieldDesc.$$index)) {
              result.error('dsc.fieldInComputedCodeIsNotTaggedAsComputed', {
                doc: docDesc.name,
                field: fieldDesc.fullname || fieldDesc.name,
                file: path.relative(process.cwd(), docCode.computed).replace(/\\/g, '/')
              });
              return;
            }

            fieldDesc.$$computed = fieldCode;
          });

          // 3. find computed fields without code
          if (computed) {
            computed.list.forEach(fieldDesc => {

              if (!fieldDesc.$$computed) {

                result.error('dsc.missingCodeForComputeField', {
                  doc: docDesc.name,
                  field: fieldDesc.fullname || fieldDesc.name,
                  file: path.relative(process.cwd(), docCode.computed).replace(/\\/g, '/')
                });
                return;
              }
            });
          }
          if (result.isError) return;

          // 4. fiх computed mask - all subfields of computed field are computed
          const newComputed = computed.clone();

          for (let i = 0; i < computed.list.length; i++) {

            const field = computed.list[i];
            if (field.hasOwnProperty('$$mask')) {
              newComputed.or(field.$$mask);
              i += field.fields.length;
            }
          }

          docDesc.fields.$$tags.computed = newComputed.lock();
        });

        if (result.isError) throw new Error(`Compilation failed`);

        const unlinkedConfig = DSCConfig.unlink(config);

        fs.writeFileSync(path.join(process.cwd(), `${toDir}/model.json`), JSON.stringify(unlinkedConfig, null, 2));

        const code = {
          docs: model.docs.code,
          api: model.api && model.api.code,
          rights: hasRights,
          validators: hasValidators,
        };

        fs.writeFileSync(path.join(process.cwd(), `${toDir}/model.code.js`), loadScript(code, path.join(process.cwd(), toDir)));

        fs.writeFileSync(path.join(process.cwd(), `${toDir}/model.server.code.js`), loadScript(code, path.join(process.cwd(), toDir), true));

        deleteRequireCache(require.resolve(path.join(process.cwd(), `${toDir}/model.code.js`)));

        // const linkedConfig = DSCConfig.link(utils.deepClone(unlinkedConfig), require('../data/model.code.js').default);
        const linkedConfig = DSCConfig.link(utils.deepClone(unlinkedConfig), true);

        // TODO: Собрать с helper'проверить $$validate и $$access на $$new

        // compareStructures(result, linkedConfig, config, 'error');

        !result.isError && compareStructures(result, DSCConfig.unlink(linkedConfig), unlinkedConfig, 'error');

        if (result.isError) throw new Error(`Link/unlink mismatch`);

        // TODO: Build client version of model

      } catch (err) {
        console.error(err);
        throw err;
      }
    },
    watch(cb) {
      chokidar.watch(path.resolve(process.cwd(), '../lib/hope/lib/**/*'), {ignoreInitial: true}).on('all', debounce(cb, 1000));
      chokidar.watch(path.join(process.cwd(), fromDir, '/**/*'), {ignoreInitial: true}).on('all', cb);
    },
  });

  function deleteRequireCache(id) {
    if (!id || ~id.indexOf('node_modules')) return;
    const m = require.cache[id];
    if (m !== undefined) {
      Object.keys(m.children).forEach(function (file) {
        deleteRequireCache(m.children[file].id);
      });
      delete require.cache[id];
    }
  }

  function loadScript(code, scriptPath, server) {
    let tab = 0;
    const res = [];

    res.push(`// NOTE: Do not edit this file manually.  It's generated by the build task\n`);

    if (server) {
      res.push(`${' '.repeat(tab)}import oncePerServices from '${path.relative(scriptPath, path.join(process.cwd(), `src/common/services/oncePerServices`)).replace(/\\/g, '/')}'\n`);
      res.push(`${' '.repeat(tab)}export default oncePerServices(function (services) {`);
      tab += TAB;
      res.push(`${' '.repeat(tab)}return {`);
      tab += TAB;
    } else {
      res.push(`${' '.repeat(tab)}export default {`);
      tab += TAB;
    }

    if (code.docs) {

      res.push(`${' '.repeat(tab)}docs: {`);
      const resLen = res.length;
      tab += TAB;

      Object.entries(code.docs).forEach(([docName, docCode]) => {

        if (docName === 'rights') return;

        res.push(`${' '.repeat(tab)}'${docName.indexOf('.') !== -1 ? docName : `doc.${docName}`}': {`);
        const resLen2 = res.length;
        tab += TAB;

        if (docCode.rights) {

          res.push(`${' '.repeat(tab)}rights: require('${path.relative(scriptPath, docCode.rights).replace(/\\/g, '/')}'),`);
        }

        if (server && docCode.computed) {

          res.push(`${' '.repeat(tab)}computed: require('${path.relative(scriptPath, docCode.computed).replace(/\\/g, '/')}').default?.(services),`);
        }

        if (server && docCode.actions) {

          res.push(`${' '.repeat(tab)}actions: {`);
          const resLen3 = res.length;
          tab += TAB;

          Object.entries(docCode.actions).forEach(([key, value]) => {
            res.push(`${' '.repeat(tab + TAB)}${key}: require('${path.relative(scriptPath, value).replace(/\\/g, '/')}').default?.(services),`);
          });

          tab -= TAB;
          if (resLen3 === res.length) {
            res.pop();
          } else {
            res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}actions: {`);
          }
        }

        Object.entries(docCode).forEach(([methodName, methodPath]) => {

          if (methodName === 'actions' || methodName === 'computed' || methodName === 'rights') return;

          res.push(`${' '.repeat(tab)}${methodName}: require('${path.relative(scriptPath, methodPath).replace(/\\/g, '/')}').default,`);
        });

        tab -= TAB;
        if (resLen2 === res.length) {
          res.pop();
        } else {
          res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}'${docName.indexOf('.') !== -1 ? docName : `doc.${docName}`}': {`);
        }
      });

      tab -= TAB;
      if (resLen === res.length) {
        res.pop();
      } else {
        res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}docs: {`);
      }
    }

    if (code.api) {

      res.push(`${' '.repeat(tab)}api: {`);
      const resLen = res.length;
      tab += TAB;

      Object.entries(code.api).forEach(([apiName, apiCode]) => {

        res.push(`${' '.repeat(tab)}${apiName}: {`);
        const resLen2 = res.length;
        tab += TAB;

        Object.entries(apiCode).forEach(([methodName, methodCode]) => {

          res.push(`${' '.repeat(tab)}${methodName}: {`);
          const resLen3 = res.length;
          tab += TAB;

          Object.entries(methodCode).forEach(([methodName, methodPath]) => {
            res.push(`${' '.repeat(tab + TAB)}${methodName}: require('${path.relative(scriptPath, methodPath).replace(/\\/g, '/')}').default,`);
          });

          tab -= TAB;
          if (resLen3 === res.length) {
            res.pop();
          } else {
            res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}${methodName}: {`);
          }
        });

        tab -= TAB;
        if (resLen2 === res.length) {
          res.pop();
        } else {
          res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}${apiName}: {`);
        }
      });

      tab -= TAB;
      if (resLen === res.length) {
        res.pop();
      } else {
        res.push(`${' '.repeat(tab)}},`); // res.push(`${' '.repeat(tab)}api: {`);
      }
    }

    if (code.rights) res.push(`${' '.repeat(tab)}rights: require('${path.relative(scriptPath, `${fromDir}/rights`).replace(/\\/g, '/')}'),`);

    if (code.validators) res.push(`${' '.repeat(tab)}validators: require('${path.relative(scriptPath, `${fromDir}/validators`).replace(/\\/g, '/')}'),`);

    tab -= TAB;
    res.push(`${' '.repeat(tab)}};`);

    if (server) {
      tab -= TAB;
      res.push(`${' '.repeat(tab)}});`);
    }

    return res.join('\n');
  };
};
