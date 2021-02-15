import fs from 'fs'
import path from 'path'
import readline from 'readline'
import {promisify} from 'util'
import {Client as PGClient} from 'pg'
import oncePerServices from '../../services/oncePerServices'
import listFiles from '../../utils/listFiles'
import {fixDependsOn} from "../../services/index"
import errorDataToEvent from '../../errors/errorDataToEvent'
const readFile = promisify(fs.readFile);

const SERVICE_TYPE = require('../../connectors/PGConnector.serviceType').SERVICE_TYPE;
const SERVICE_NAME = 'postgres/evolutions';

export const name = require('../../services/serviceName').default(__filename);

const pgSchema = require('../../connectors/PGConnector.schema');
const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus
  } = services;

  class Evolutions {

    async process(args) {
      schema.process_args(args);
      const {context, postgres, silent, lock, dev, schemaDir, codeDir} = args;

      pgSchema.ctor_settings(this, postgres);
      this._settings = postgres;
      this._schemaDir = path.resolve(process.cwd(), schemaDir || 'db/evolutions/schema');
      this._codeDir = path.resolve(process.cwd(), codeDir || 'db/evolutions/code');
      this._silent = !!silent;
      this._lock = !!lock;
      this._dev = !!dev;

      this._settingsWithoutPassword = {...this._settings};
      delete this._settingsWithoutPassword.password;
      fixDependsOn(this._settingsWithoutPassword);
      bus.info({
        type: 'service.settings',
        service: SERVICE_NAME,
        serviceType: SERVICE_TYPE,
        settings: this._settingsWithoutPassword,
      });

      const isNewDB = await this._checkAndCreateDB({context});
      if (isNewDB === undefined) return true;

      this._client = new PGClient(this._settings);
      await this._client.connect();
      try {
        let scripts = [];
        if (isNewDB) {
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

        let applyChangesToProd = false;

        if (!this._compareFiles({context, files, scripts})) {
          bus.info({
            context,
            type: 'evolutions.upToDate',
            service: SERVICE_NAME,
          });
        } else {
          if (this._lock) {
            if (!(applyChangesToProd = await this._ask(`Do you want to apply those changes to the production database?`))) {
              return;
            }
          }

          try {
            await this._applyFiles({context, files, scripts});
            bus.info({
              context,
              type: 'evolutions.applied',
              service: SERVICE_NAME,
            });
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
              return true;
            } else if (err.code === 'locked') {
              bus.error({
                context,
                type: 'evolutions.locked',
                service: SERVICE_NAME,
                errorMsg: err.message,
                filename: err.filename,
              });
              return true;
            }
            throw err;
          }
        }

        if (this._lock) {
          let i;
          for (i = files.length; i-- > 0;) {
            const file = files[i];
            if (file.schema) break;
          }

          const res = await this._client.query(`SELECT index FROM __scripts WHERE index <= $1 AND NOT locked`, [i]);
          if (res.rowCount > 0) {
            if (applyChangesToProd || await this._ask(`Do you want to lock a current database schema?`)) {
              await this._client.query(`UPDATE __scripts SET locked = true WHERE index <= $1 AND NOT locked`, [i]);
              bus.info({
                context,
                type: 'evolutions.schemaLocked',
                service: SERVICE_NAME,
              });
            }
          }
        }
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
      try {
        await client.connect();
        const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`, [this._settings.database]);
        if (res.rowCount === 0) {
          if (!(await this._ask(`Do you want to create a new database '${this._settings.database}'?`))) {
            return;
          }
          await client.query(`CREATE DATABASE ${this._settings.database};`);
          bus.info({
            context,
            type: 'evolutions.dbCreated',
            service: SERVICE_NAME,
            settings: this._settingsWithoutPassword,
          });
          return true;
        }
        return false;
      } catch (error) {
        const errEvent = {
          context,
          type: 'nodemanager.error',
          service: SERVICE_NAME,
        };
        errorDataToEvent(error, errEvent);
        bus.error(errEvent);
      } finally {
        await client.end();
      }
    }

    async _loadScripts({context}) {
      try {
        return (await this._client.query(`SELECT * FROM __scripts ORDER BY index;`)).rows;
      } catch (err) {
        if (err.code === '42P01') return; // table does not exists
        throw err;
      }
    }

    async _createScriptsTable({context}) {
      await this._client.query(`
CREATE TABLE __scripts (
  index INT NOT NULL,
  filename VARCHAR(1024) NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  sql TEXT NOT NULL,
  applied_at TIMESTAMP
);
CREATE UNIQUE INDEX ON __scripts (filename);
CREATE UNIQUE INDEX ON __scripts (index);`);
    }

    async _applyFiles({context, files, scripts}) {
      let changeStart = 0;
      for (; changeStart < scripts.length && changeStart < files.length; changeStart++) {
        const file = files[changeStart];
        const script = scripts[changeStart];
        if (script.applied_at === null || file.filename !== script.filename || file.filebody !== script.sql) break;
      }
      for (let i = scripts.length; i-- > changeStart;) {
        const script = scripts[i];
        if (script.locked) {
          const err = new Error(`cannot update database. it is locked until '${script.filename}'`);
          err.code = 'locked';
          throw err;
        }
      }
      await this._transaction({
        context, body: async () => {
          for (let i = scripts.length; i-- > changeStart;) {
            const script = scripts[i];
            try {
              if (script.applied_at !== null) {
                const updown = Evolutions.parseSQL(script.sql);
                try {
                  await this._client.query(updown.downs);
                } catch (err) {
                  if (err.hasOwnProperty('position')) {
                    const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                    err.line = updown.downsLine + 1 + (lines ? lines.length : 0);
                  }
                  throw err;
                }
              }
              await this._client.query(`DELETE FROM __scripts WHERE index = $1`, [script.index]);
            } catch (err) {
              err.filename = script.filename;
              err.sctiptId = script.id;
              throw err;
            }
          }
        }
      });
      await this._transaction({
        context, body: async () => {
          for (let i = changeStart; i < files.length; i++) {
            const file = files[i];
            await this._client.query(`INSERT INTO __scripts(index, filename, sql) VALUES ($1, $2, $3)`, [
              i,
              file.filename,
              file.filebody,
            ]);
          }
        }
      });
      for (let i = changeStart; i < files.length; i++) {
        const file = files[i];
        let updown;
        try {
          updown = Evolutions.parseSQL(file.filebody);
          await this._transaction({
            context, body: async () => {
              try {
                await this._client.query(updown.ups);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                  err.line = updown.upsLine + 1 + (lines ? lines.length : 0);
                  err.message = `before '!Downs': ${err.message}`;
                }
                throw err;
              }
              try {
                await this._client.query(updown.downs);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.downs.substr(0, err.position).match(/\r?\n/g);
                  err.line = updown.downsLine + 1 + (lines ? lines.length : 0);
                }
                throw err;
              }
              try {
                await this._client.query(updown.ups);
              } catch (err) {
                if (err.hasOwnProperty('position')) {
                  const lines = updown.ups.substr(0, err.position).match(/\r?\n/g);
                  err.line = updown.upsLine + 1 + (lines ? lines.length : 0);
                  err.message = `after '!Downs': ${err.message}`;
                }
                throw err;
              }
              if (this._dev && updown.dev) {
                try {
                  await this._client.query(updown.dev);
                } catch (err) {
                  if (err.hasOwnProperty('position')) {
                    const lines = updown.dev.substr(0, err.position).match(/\r?\n/g);
                    err.line = updown.devLine + 1 + (lines ? lines.length : 0);
                  }
                  throw err;
                }
              }
              await this._client.query(`UPDATE __scripts SET applied_at = now() WHERE index = $1`, [i]);
            }
          });
        } catch (err) {
          err.filename = file.filename;
          throw err;
        }
      }
    }

    async _ask(question) {
      return this._silent || await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question(bus._warn(`${question} [y/N] `), (answer) => {
          resolve(/^(y(es)?|true)$/i.test(answer.trim()));
          rl.close();
        });
      })
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

    _compareFiles({context, files, scripts}) {
      let changed = false;
      files.forEach(file => {
        const script = scripts.find(v => v.filename === file.filename);
        if (script) {
          if (script.sql !== file.filebody) {
            changed = true;
            bus.info({
              context,
              type: 'evolutions.change',
              service: SERVICE_NAME,
              change: 'changed',
              filename: file.filename,
            });
          }
        } else {
          changed = true;
          bus.info({
            context,
            type: 'evolutions.change',
            service: SERVICE_NAME,
            change: 'new',
            filename: file.filename,
          });
        }
      });
      scripts.forEach(script => {
        if (script.applied_at === null) {
          changed = true;
        }
        if (!files.find(v => v.filename === script.filename)) {
          changed = true;
          bus.info({
            context,
            type: 'evolutions.change',
            service: SERVICE_NAME,
            change: 'removed',
            filename: script.filename,
          });
        }
      });
      return changed;
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

  return function process(options) {
    return new Evolutions().process(options);
  };
});
