import {missingArgument, invalidArgument} from '../validation'
const hasOwnProperty = Object.prototype.hasOwnProperty;
const schema = require(`./TypeBuilder.schema`);

export default class TypeBuilder {

  _description; // текстовое описание типа для graphql
  _fields = []; // список добавленных полей

  constructor(options) {
    schema.ctor_options(this, options);
  }

  /**
   * Добавляет поле/query/ mutation в тип, который этот билдер собирает.
   */
  addField(field = missingArgument('field')) {
    schema.addField_field(field);
    this._fields.push(field);
  }

  setDescription(description = missingArgument('description')) {
    if (!(typeof description === 'string' && description.length > 0)) invalidArgument('description', description);
    this._description = description;
  }

  build() {
    if (this._fields.length > 0)
      return `${formatDescription(this._description)}${this._isSchema ? `schema` : `type ${this._name}`} {\n${
        this._fields.map(f =>          
          `${formatDescription(f.description)}${f.name}${f.args ? `(${formatArgs(f.args)})` : ''}: ${f.type}`)
          .join(',\n')
      }\n}`;
  }
}

function formatArgs(args) {
  if (typeof args === 'string') return `\n${args}`; // перенос на случай если в начале строки сразу идет комментарий
  const res = [];
  for (const a of args) {
    if (typeof a === 'string') res.push(`\n${a},`); // перенос на случай если в начале строки сразу идет комментарий
    else { // {name, type, description}
      if (hasOwnProperty.call(a, 'description')) res.push(`\n${formatDescription(a.description)}`);
      res.push(`${a.name}: ${a.type},`);
    }
  }
  return res.join('');
}

function formatDescription(description) {
  if (!description) return '';
  const strings = description.split(/\n/);
  const res = [];
  let beginning = true;
  for (const line of strings) {
    if (beginning && line.trim().length === 0) continue; // пропускаем начальные пустые строки
    beginning = false;
    if (/\s*#/.test(line)) res.push(/^\s*(#.*)$/.exec(line)[0]); // для более красивого форматирования комментариев, можно ставить решетки на этапе определения комменатриев
    else res.push(`# ${line}`);
    res.push('\n');
  }
  return res.join('');
}
