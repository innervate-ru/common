const schema = require(`./TypeBuilder.schema`);
const VALIDATE_FIELDS = {argument: 'fields'};

export default class TypeBuilder {

  constructor(options) {
    schema.TypeBuilderOptions(options, {argument: 'options', copyTo: this});
    this._fields = [];
  }

  /**
   * Добавляет запрос graphql в тип, который этот билдер собирает.
   *
   * @param name Название поля/метода
   * @param args Массив строк, где каждая строка соотвествует аргументу ...или просто строка с аргументами через заяпятую внутри
   * @param type Тип поля/метода
   */
  addField(field) {
    schema.buildMethodOptions(field, VALIDATE_FIELDS);
    this._fields.push(field);
  }

  build() {
    if (this._fields.length > 0)
      return `${this._isSchema ? `schema` : `type ${this._name}`} {${
        this._fields.map(f => `${f.name}${f.args ? `(${typeof f.args === 'string' ? f.args : f.args.join(', ')})` : ''}: ${f.type}`).join(', ')
      }}`;
  }
}
