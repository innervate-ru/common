import {promisify} from 'util'
import path from 'path'
import fs from 'fs'
import chokidar from 'chokidar'
import linkConfig from '../../../../../lib/hope/lib/config/_link'
import {Task} from '../../build/index'

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const TAB = 2;

export default function ({fromDir = 'data', modelDir = 'model', toDir = 'db/evolutions/schema'} = {}) {

  const modelJson = path.relative(__dirname, path.join(process.cwd(), fromDir, 'model.json'));
  const validators = path.relative(__dirname, path.join(process.cwd(), modelDir, 'validators'));

  return new Task({
    name: `Generate db schema from '${fromDir}/model.json' to '${toDir}'`,
    async run() {

      try {

        deleteRequireCache(require.resolve(modelJson));
        deleteRequireCache(require.resolve(validators));
        const config = linkConfig(require(modelJson), {
          docs: {},
          validators: require(validators)
        }, {server: true});


        const filesMap = fs.readdirSync(path.join(process.cwd(), toDir))
          .map(filename => path.parse(filename))
          .filter(filename => filename.ext === '.sql')
          .filter(filename => filename.name.startsWith('doc_'))
          .reduce((acc, filename) => {
            acc[filename.name] = false;
            return acc;
          }, {});

        await Promise.all(config.docs.$$list.map(async (doc) => {
          const table = buildTableDefinition(doc);
          const filename = `${doc.name.startsWith('doc.') ? '' : `doc_`}${doc.$$table}`;
          await writeFile(path.join(process.cwd(), `${toDir}/${filename }.sql`), createTableScript(table));
          filesMap[filename] = true;
        }));

        await Promise.all(Object.entries(filesMap)
          .filter(([_, saved]) => !saved)
          .map(async ([filename]) => {
            await unlink(path.join(process.cwd(), `${toDir}/${filename}.sql`));
          }));

      } catch (err) {
        console.error(err);
      }
    },
    watch(cb) {
      chokidar.watch(path.join(process.cwd(), modelJson), {ignoreInitial: true}).on('all', cb);
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

  function buildTableDefinition(doc) {

    const table = {name: doc.$$table, fields: {}, indecies: {}};

    doc.fields.$$tags.field.list.forEach(field => {
      const r = table.fields[field.$$field] = {type: field.type};
      switch (field.type) {
        case 'string':
          r.length = field.length;
          break;
        case 'structure':
          throw new Error(`'structure' as database field is not supported yet`);
        case 'subtable':
          throw new Error(`'subtable' as database field is not supported`);
      }
      if (field.hasOwnProperty('null')) r.null = field.null;
      if (field.hasOwnProperty('init')) r.init = field.init;

      if (doc.fields.$$tags.index.get(field.$$index)) {
        const d = table.indecies[field.name] = {};
        if (doc.fields.$$tags.unique.get(field.$$index)) d.unique = true;
        if (field.type === 'json') d.gin = true;
      }
    });

    return table;
  }

  function createTableScript(table) {
    let tab = 0;
    const res = [];

    res.push(`-- NOTE: Do not edit this file manually.  It's generated by the build task\n`);

    res.push(`-- !Table\n`);

    res.push(JSON.stringify(table, null, 2));

    res.push(`\n-- !Downs\n`);

    res.push(`DROP TABLE IF EXISTS public.${table.name};`);

    res.push(`\n-- !Ups\n`);

    // TODO: Json
    // up - down

    res.push(`${' '.repeat(tab)}DO $$ BEGIN IF NOT EXISTS (SELECT * FROM pg_proc WHERE proname = 'moddatetime') THEN CREATE EXTENSION moddatetime; END IF; END; $$;\n`);

    res.push(`${' '.repeat(tab)}CREATE TABLE public.${table.name} (`);
    tab += TAB;

    const fields = Object.entries(table.fields);
    fields.forEach(([fieldName, field], i) => {
        res.push(`${' '.repeat(tab)}${fieldName} ${fieldDeclaration(fieldName, field)}${fields.length - 1 === i ? '' : ','}`);
    });

    tab -= TAB;
    res.push(`${' '.repeat(tab)});`);

    res.push(`\n${' '.repeat(tab)}CREATE TRIGGER mdt_moddatetime BEFORE UPDATE ON public.${table.name} FOR EACH ROW EXECUTE PROCEDURE moddatetime (modified);`);

    Object.entries(table.indecies).forEach(([fieldName, opts], i) => {
      res.push(`\n${' '.repeat(tab)}CREATE${opts.unique ? ' UNIQUE' : ''} INDEX ON public.${table.name} ${opts.gin ? `USING GIN(${fieldName})` : `(${fieldName})`};`)
    });

    return res.join('\n');
  }

  function fieldDeclaration(fieldName, field) {
    const res = [];
    switch (field.type) {
      case 'string':
        res.push(`VARCHAR(${field.length})`);
        break;
      case 'text':
        res.push(`TEXT`);
        break;
      case 'boolean':
        res.push(`BOOLEAN`);
        break;
      case 'integer':
        res.push(`INTEGER`);
        break;
      case 'double':
        res.push(`DOUBLE PRECISION`);
        break;
      case 'nanoid':
        res.push(`CHAR(21)`);
        break;
      case 'date':
        res.push(`DATE`);
        break;
      case 'time':
        res.push(`TIME WITHOUT TIME ZONE`);
        break;
      case 'datetime':
      case 'timestamp':
        res.push(`TIMESTAMP WITHOUT TIME ZONE`);
        break;
      case 'json':
        res.push(`JSONB`);
        break;
      default:
        throw new Error(`Unexpected type: ${JSON.stringify(field)}`);
    }

    if (!field.null) res.push(`NOT NULL`);

    if (field.hasOwnProperty('init')) res.push(`DEFAULT ${typeof field.init === 'string' ? `'${field.init}'` : field.init}`);

    if (~['created', 'modified'].indexOf(fieldName)) res.push(`DEFAULT now()`);

    return res.join(' ')
  }
};
