import fs from 'fs';
import path from 'path';
import configAPI from 'config'
import {Client as PGClient} from 'pg'
import oncePerServices from '../../services/oncePerServices'
import listFiles from '../../utils/listFiles'
import {fixDependsOn} from "../../services/index";
import addPrefixToErrorMessage from "../../utils/addPrefixToErrorMessage";

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

      const isNewDB = await this._checkAndCreateDB();
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
          await this._createScriptsTable();
        } else {
          scripts = await this._loadScripts();
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

        const files = await this._loadSQLFiles();

        await this._applyFiles({context, files});

        // const diff = this._compareFiles({files, scripts});

      } finally {
        await this._client.end();
      }
    }

    async _loadSQLFiles() {
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

    async _checkAndCreateDB() {
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

    async _loadScripts() {
      try {
        return (await this._client.query(`SELECT * FROM __scripts ORDER BY id;`)).rows;
      } catch (err) {
        if (err.code === '42P01') return; // table does not exists
        throw err;
      }
    }

    async _createScriptsTable() {
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

    async _applyFiles({context, files}) {
      const list = files.map((file, i) => {
        try {
          return {
            id: i + 1,
            ...file,
            ...Evolutions.parseSQL(file.filebody),
          };
        } catch (err) {
          addPrefixToErrorMessage(`File '${file.filename}'`, err);
        }
      });
      for (const updown of list) {
        try {
          await this._client.query(`BEGIN`);
          await this._client.query(updown.ups);
          await this._client.query(`INSERT INTO __scripts(id, filename, locked, sql) VALUES ($1, $2, $3, $4)`, [
            updown.id,
            updown.filename,
            false,
            updown.filebody,
          ]);
          await this._client.query(`COMMIT`);
        } catch (err) {
          await this._client.query(`ROLLBACK`);
          throw err;
        }
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
          if (res.hasOwnProperty('ups')) throw new Error(`Duplicated '-- !Ups' at line ${i + 1}`);
          s = 0;
        } else if (/^\s*--\s*!\s*down[s]?\s*$/i.test(line)) {
          saveBlock(i);
          if (res.hasOwnProperty('downs')) throw new Error(`Duplicated '-- !Downs' at line ${i + 1}`);
          s = 1;
        } else if (/^\s*--\s*!\s*dev\s*$/i.test(line)) {
          saveBlock(i);
          if (res.hasOwnProperty('dev')) throw new Error(`Duplicated '-- !Dev' at line ${i + 1}`);
          s = 2;
        }
      });
      saveBlock(lines.length);
      const hasUps = res.hasOwnProperty('ups');
      const hasDowns = res.hasOwnProperty('downs');
      if (!hasUps && !hasDowns) {
        throw new Error(`Missing '-- !Ups' and '-- !Downs' sections`);
      } else if (!hasUps) {
        throw new Error(`Missing '-- !Ups' section`);
      } else if (!hasDowns) {
        throw new Error(`Missing '-- !Downs' section`);
      }
      return res;
    }
  }

  return Evolutions;
});
