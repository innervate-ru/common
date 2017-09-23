import {missingArgument, invalidArgument} from '../utils/arguments'
import prettyPrint from '../utils/prettyPrint'
import sortBy from 'lodash/sortBy'
import TypeBuilder from './TypeBuilder'
import LevelBuilder from './LevelBuilder'

const schema = require('./SchemaBuilder.schema');

const QUERY_ROOT_TYPE = 'RootQuery';
const MUTATION_ROOT_TYPE = 'RootMutation';

function assembleSublevel(parentLevelBuilder, parentContext, branch) {
  if (typeof branch === 'function') {
    parentLevelBuilder.addBuilder(branch);
  } else if (typeof branch === 'object' && branch != null && !Array.isArray(branch)) {
    let name;
    const context = () => `${parentContext()}.${name}`;
    for (name of Object.getOwnPropertyNames(branch)) {
      const levelBuilder = new LevelBuilder({name});
      parentLevelBuilder.addBuilder(levelBuilder);
      assembleSublevel(levelBuilder, context, branch[name]);
    }
  }
  else throw new Error(`Branch '${parentContext()}' has invalid value: ${prettyPrint(branch)}`);
}

export default class SchemaBuilder extends LevelBuilder {

  constructor(schemaTree) {
    super({name: 'Root'});
    schema.ctor_schemaTree(schemaTree);

    this._resolvers = this._levelQueryResolver = this._levelMutationResolver = null;

    if (schemaTree) {
      if (!(typeof schemaTree === 'object' && schemaTree != null && !Array.isArray(schemaTree))) invalidArgument('schemaTree', schemaTree);
      let name;
      const context = () => name;
      for(name of Object.getOwnPropertyNames(schemaTree)) {
        const levelBuilder = new LevelBuilder({name});
        this.addBuilder(levelBuilder);
        assembleSublevel(levelBuilder, context, schemaTree[name]);
      }
    }
  }

  /**
   * Тип RootQuery и RootMutation не добавляются в имя типа.
   */
  getTypeBaseName() {
    return ``;
  }

  /**
   * Возвращает объект resolver для query данного уровня.
   */
  _getQueryResolver() {
    return this._levelQueryResolver || (this._levelQueryResolver = this._resolvers[QUERY_ROOT_TYPE] = Object.create(null));
  }

  /**
   * Возвращает объект resolver для mutation данного уровня.
   */
  _getMutationResolver() {
    return this._levelMutationResolver || (this._levelMutationResolver = this._resolvers[MUTATION_ROOT_TYPE] = Object.create(null));
  }

  async build(options = missingArgument('options')) {
    schema.build_options(options)

    const {typeDefs, resolvers} = options;

    if (!(Array.isArray(typeDefs))) invalidArgument('typeDefs', typeDefs);
    if (!(typeof resolvers === 'object' && resolvers != null && !Array.isArray(resolvers))) invalidArgument('resolvers', resolvers);

    this._typeDefs = typeDefs;
    this._resolvers = resolvers;

    await this._runBuilders({...options, context: Object.create(null)});

    const hasQueries = (this._queries.length > 0);
    const hasMutations = (this._mutations.length > 0);

    if (!hasQueries && !hasMutations) throw new Error(`Schema is empty`);

    if (hasQueries) {
      const typeBuilder = new TypeBuilder({name: QUERY_ROOT_TYPE});
      sortBy(this._queries, v => v.name);
      this._queries.forEach(v => typeBuilder.addField(v));
      typeDefs.push(typeBuilder.build());
    }

    if (hasMutations) {
      const typeBuilder = new TypeBuilder({name: MUTATION_ROOT_TYPE});
      sortBy(this._mutations, v => v.name);
      this._mutations.forEach(v => typeBuilder.addField(v));
      typeDefs.push(typeBuilder.build());
    }

    const schemaBuilder = new TypeBuilder({name: 'Schema', isSchema: true});
    if (hasQueries) schemaBuilder.addField({name: 'query', type: QUERY_ROOT_TYPE});
    if (hasMutations) schemaBuilder.addField({name: 'mutation', type: MUTATION_ROOT_TYPE});
    typeDefs.push(schemaBuilder.build());
  }
}
