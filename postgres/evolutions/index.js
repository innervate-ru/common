import fs from 'fs';
import path from 'path';
import {Client as PGClient} from 'pg'
import oncePerServices from '../../services/oncePerServices'
import listFiles from '../../utils/listFiles'
import {fixDependsOn} from "../../services/index";

const readFile = Promise.promisify(fs.readFile);

const SERVICE_TYPE = require('../../connectors/PGConnector.serviceType').SERVICE_TYPE;
const SERVICE_NAME = 'postgres/evolutions'

export const name = require('../../services/serviceName').default(__filename);

const pgSchema = require('../../connectors/PGConnector.schema');
const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus
  } = services;

  class Evolutions {

    constructor(settings) {
      pgSchema.ctor_settings(this, settings);
      this._settings = settings;
      this._schemaDir = path.resolve(process.cwd(), 'db/evolutions/schema');
      this._codeDir = path.resolve(process.cwd(), 'db/evolutions/code');

      this._settingsWithoutPassword = {...this._settings};
      delete this._settingsWithoutPassword.password;
      fixDependsOn(this._settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: SERVICE_NAME,
        serviceType: SERVICE_TYPE,
        settings: this._settingsWithoutPassword,
      });
    }

    async process(args) {
      schema.process_args(args);
      const {context} = args;

      // TODO: arg - lock in production
      // TODO: Think of watch
      // TODO: Make color table output

      const isNewDB = await this._checkAndCreateDB({context});
      this._client = new PGClient(this._settings);
      await this._client.connect();
      try {
        let scripts = [];
        if (isNewDB) {
          bus.info({
            context,
            type: 'evolutions.dbCreated',
            service: SERVICE_NAME,
            settings: this._settingsWithoutPassword,
          });
          await this._createScriptsTable({context});
        } else {
          scripts = await this._loadScripts({context});
          if (!scripts) {
            bus.error({
              context,
              type: 'evolutions.noScripts',
              service: SERVICE_NAME,
              settings: this._settingsWithoutPassword,
            });
            return;
          }
        }

        const files = await this._loadSQLFiles({context});

        try {
          await this._applyFiles({context, files, scripts});
        } catch (err) {
          if (err.hasOwnProperty('filename')) {
            bus.error({
              context,
              type: 'evolutions.sqlError',
              service: SERVICE_NAME,
              errorMsg: err.message,
              filename: err.filename,
              scriptId: err.scriptId,
              line: err.line,
            });
          } else {
            throw err;
          }
        }

        // const diff = this._compareFiles({files, scripts});

      } finally {
        await this._client.end();
      }
    }

    async _loadSQLFiles({context}) {
      return (await Promise.all([
        Promise.all((await listFiles(this._schemaDir)).map(async (v) => ({
          schema: true,
          filename: path.relative(process.cwd(), v).replace(/\\/g, '/'),
          filebody: (await readFile(v)).toString(),
        }))),
        Promise.all((await listFiles(this._codeDir)).map(async (v) => ({
          filename: path.relative(process.cwd(), v).replace(/\\/g, '/'),
          filebody: (await readFile(v)).toString(),
        }))),
      ])).flatMap(v => v);
    }

    async _checkAndCreateDB({context}) {
      const client = new PGClient({
        ...this._settings,
        database: 'postgres',
      });
      await client.connect();
      try {
        await client.query(`create database ${this._settings.database};`);
        return true;
      } catch (err) {
        // database exists
        if (!err.code || err.code !== '42P04') throw err;
      } finally {
        await client.end();
      }
    }

    async _loadScripts({context}) {
      try {
        return (await this._client.query(`SELECT * FROM __scripts ORDER BY id;`)).rows;
      } catch (err) {
        if (err.code === '42P01') return; // table does not exists
        throw err;
      }
    }

    async _createScriptsTable({context}) {
      await this._client.query(`
CREATE TABLE __scripts (
  id INT NOT NULL,
  filename VARCHAR(1024) NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  sql TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON __scripts (id);`);
    }

    async _applyFiles({context, files, scripts, dev}) {
      let changeStart = 0;
      for (; changeStart < scripts.length && changeStart < files.length; changeStart++) {
        const file = files[changeStart];
        const script = scripts[changeStart];
        if (file.filebody !== script.sql) break;
      }
      // TODO: Check for locked files
      for (let i = scripts.length; i-- > changeStart;) {
        const script = scripts[i];
        await this._transaction({
          context, body: async () => {
            const updown = Evolutions.parseSQL(script.sql);
            try {
              await this._client.query(updown.downs);
            } catch (err) {
              if (err.hasOwnProperty('position')) {
                const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                err.filename = script.filename;
                err.sctiptId = script.id;
                err.line = updown.downsLine + 1 + (lines ? lines.length : 0);
              }
              throw err;
            }
            await this._client.query(updown.downs);
            await this._client.query(`DELETE FROM __scripts WHERE id = $1`, [script.id]);
          }
        });
      }
      for (let i = changeStart; i < files.length; i++) {
        const file = files[i];
        let updown;
        try {
          updown = Evolutions.parseSQL(file.filebody);
        } catch (err) {
          err.filename = file.filename;
          throw err;
        }
        // накатываем ups и откатываем downs.  При первой попытке выводим ошибки.  При второй считаем что в
        // скрипте ошибка, которую должен исправить пользователь.
        for (let attempt = 0; ; attempt++) {
          let isError = false;
          await this._transaction({
            context, body: async () => {
              try {
                await this._client.query(updown.ups);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                  err.filename = file.filename;
                  err.line = updown.upsLine + 1 + (lines ? lines.length : 0);
                  if (attempt > 0) throw err;
                  isError = true;
                  bus.error({
                    context,
                    type: 'evolutions.sqlError',
                    service: SERVICE_NAME,
                    errorMsg: err.message,
                    filename: err.filename,
                    line: err.line,
                  });
                } else {
                  throw err;
                }
              }
            }
          });
          await this._transaction({
            context, body: async () => {
              try {
                await this._client.query(updown.downs);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.downs.substr(0, err.position).match(/\r?\n/g);
                  err.filename = file.filename;
                  err.line = updown.upsLine + 1 + (lines ? lines.length : 0);
                  if (attempt > 0) throw err;
                  isError = true;
                  bus.error({
                    context,
                    type: 'evolutions.sqlError',
                    service: SERVICE_NAME,
                    errorMsg: err.message,
                    filename: err.filename,
                    line: err.line,
                  });
                } else {
                  throw err;
                }
              }
            }
          });
          if (!isError) break;
        }
        await this._transaction({
          context, body: async () => {
            try {
              await this._client.query(updown.ups);
            } catch (err) {
              if (err.hasOwnProperty('position')) {
                const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                err.filename = file.filename;
                err.line = updown.upsLine + 1 + (lines ? lines.length : 0);
                throw err;
              }
            }
            if (dev && updown.dev) {
              try {
                await this._client.query(updown.dev);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                  err.filename = file.filename;
                  err.line = updown.devLine + 1 + (lines ? lines.length : 0);
                }
                throw err;
              }
            }
            await this._client.query(`INSERT INTO __scripts(id, filename, locked, sql) VALUES ($1, $2, $3, $4)`, [
              i,
              file.filename,
              false, // TODO: true, is prod mode and its schema
              file.filebody,
            ]);
          }
        });
      }
    }

    async _transaction({context, body}) {
      try {
        await this._client.query(`BEGIN`);
        await body();
        await this._client.query(`COMMIT`);
      } catch (err) {
        await this._client.query(`ROLLBACK`);
        throw err;
      }
    }

    _compareFiles({files, scripts}) {
      // TODO:
    }

    /**
     * Парсит sql-скрипт
     * -- !Downs часть - sql-скрипт "отката"
     * -- !Ups часть - sql-скрипт "наката"
     * -- !Dev часть - sql-скрипт выполняемый только для БД в фазе разработки
     * **/
    static parseSQL(filebody) {
      const res = {};
      let s = -1; // 0 - !Ups; 1 - !Downs; 2 - !Dev
      let startLine;
      const lines = filebody.split(/\r?\n/);

      function saveBlock(end) {
        if (s >= 0) {
          res[['ups', 'downs', 'dev'][s]] = lines.slice(startLine + 1, end).join('\n');
          res[['upsLine', 'downsLine', 'devLine'][s]] = startLine + 1;
        }
        startLine = end;
      }

      lines.forEach((line, i) => {
        if (/^\s*--\s*!\s*up[s]?\s*$/i.test(line)) {
          saveBlock(i);
          if (res.hasOwnProperty('ups')) throw new Error(`line ${i + 1}: duplicated '-- !Ups'`);
          s = 0;
        } else if (/^\s*--\s*!\s*down[s]?\s*$/i.test(line)) {
          saveBlock(i);
          if (res.hasOwnProperty('downs')) throw new Error(`line ${i + 1}: duplicated '-- !Downs'`);
          s = 1;
        } else if (/^\s*--\s*!\s*dev\s*$/i.test(line)) {
          saveBlock(i);
          if (res.hasOwnProperty('dev')) throw new Error(`line ${i + 1}: duplicated '-- !Dev'`);
          s = 2;
        }
      });
      saveBlock(lines.length);
      const hasUps = res.hasOwnProperty('ups');
      const hasDowns = res.hasOwnProperty('downs');
      if (!hasUps && !hasDowns) {
        throw new Error(`мissing '-- !Ups' and '-- !Downs' sections`);
      } else if (!hasUps) {
        throw new Error(`мissing '-- !Ups' section`);
      } else if (!hasDowns) {
        throw new Error(`мissing '-- !Downs' section`);
      }
      return res;
    }
  }

  return Evolutions;
});
