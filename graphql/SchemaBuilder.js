import {missingArgument, invalidArgument} from '../utils/arguments'
import sortBy from 'lodash/sortBy'
import TypeBuilder from './TypeBuilder'
import LevelBuilder from './LevelBuilder'
import {validateArgumentNameOptions} from '../validation'

const schema = require('./SchemaBuilder.schema');

export default class SchemaBuilder extends LevelBuilder {

  constructor() {
    super({name: 'Root'});

    this._resolvers = null;
  }

  /**
   * Тип RootQuery и RootMutation не добавляются в имя типа.
   */
  getTypeBaseName() {
    return ``;
  }

  /**
   * Возвращает корневой объект resolver.
   */
  getResolver() {
    return this._resolvers;
  }

  async build(options = missingArgument('options')) {
    schema.SchemaBuilderBuildMethodOptions(options, validateArgumentNameOptions);

    const {typeDefs, resolvers} = options;

    if (!(Array.isArray(typeDefs))) invalidArgument('typeDefs', typeDefs);
    if (!(typeof resolvers === 'object' && resolvers != null && !Array.isArray(resolvers))) invalidArgument('resolvers', resolvers);

    this._typeDefs = typeDefs;
    this._resolvers = resolvers;

    await this._runBuilders(options);

    const hasQueries = (this._queries.length > 0);
    const hasMutations = (this._mutations.length > 0);

    if (!hasQueries && !hasMutations) throw new Error(`Schema is empty`);

    if (hasQueries) {
      const typeName = `RootQuery`;
      const typeBuilder = new TypeBuilder({name: typeName});
      sortBy(this._queries, v => v.name);
      this._queries.forEach(v => typeBuilder.addField(v));
      typeDefs.push(typeBuilder.build());
    }

    if (hasMutations) {
      const typeName = `RootMutation`;
      const typeBuilder = new TypeBuilder({name: typeName});
      sortBy(this._mutations, v => v.name);
      this._mutations.forEach(v => typeBuilder.addField(v));
      typeDefs.push(typeBuilder.build());
    }

    const schemaBuilder = new TypeBuilder({name: 'Schema', isSchema: true});
    if (hasQueries) schemaBuilder.addField({name: 'query', type: `RootQuery`});
    if (hasMutations) schemaBuilder.addField({name: 'mutation', type: `RootMutation`});
    typeDefs.push(schemaBuilder.build());
  }
}
