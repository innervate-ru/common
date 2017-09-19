import {missingArgument, invalidArgument} from '../utils/arguments'
import sortBy from 'lodash/sortBy'
import TypeBuilder from './TypeBuilder'
import {validateArgumentNameOptions} from '../validation'

const schema = require('./SchemaBuilder.schema');
const VALIDATE_QUERY = {argument: 'query'};
const VALIDATE_MUTATION = {argument: 'mutation'};

/**
 * Хотя apollo-server позволяет задавать схему как набор отдельных фрагментов, и позволяет делать 'extend type' - http://dev.apollodata.com/tools/graphql-tools/generate-schema.html#extend-types
 *
 * Однако проблема в том, что нельзя определить тип без полей и методов, и это делает extend type достаточно бесполезным для создания объединяющих типов, например: cyberlines, data ...
 * Поэтому возникла идея сделать билдер, который будет генерировать родительский тип, только если в него ранее добавили query и/или mutations.
 */
export default class LevelBuilder {

  /**
   *
   * @param name Имя типа
   */
  constructor(options) {

    schema.LevelBuilderOptions(options, {argument: 'options', copyTo: this});

    this._queries = [];
    this._mutations = [];

    this._builders = [];
    this._buildersCompletedCount = 0;

    this._parentLevelBuilder = this._typeDefs = this._resolvers = this._levelQueryResolver = this._levelMutationResolver = this._done = this._builderArgs = null;
  }

  addBuilder(builder = missingArgument('builder')) {
    if (!(builder instanceof LevelBuilder || typeof builder === 'function')) invalidArgument('builder', builder);
    this._builders.push(builder);
    if (this._done) { // добавление билдера в момент, когда уже this.build() вызван
      if (this._done.isFulfilled) throw new Error(`Invalid state: this.build() is already completed, and it's too later to add a new builder`);
      builder.build(this._builderArgs).then(_builderFinished);
    }
  }

  /**
   * Добавляет запрос graphql в тип, который этот билдер собирает.
   *
   * @param name Название поля/метода
   * @param args Массив строк, где каждая строка соотвествует аргументу ...или просто строка с аргументами через заяпятую внутри
   * @param type Тип поля/метода
   */
  addQuery(query = missingArgument('query')) {
    schema.addFieldOptions(query, VALIDATE_QUERY)
    const {name = missingArgument('name'), type = missingArgument('type'), typeDef, resolver} = query;
    if (typeDef) this._typeDefs.push(typeDef);
    this._queries.push(query);
    if (resolver) this._getQueryResolver()[name] = resolver;
  }

  /**
   * Добавляет запрос graphql в тип, который этот билдер собирает.
   *
   * @param name Название поля/метода
   * @param args Массив строк, где каждая строка соотвествует аргументу ...или просто строка с аргументами через заяпятую внутри
   * @param type Тип поля/метода
   */
  addMutation(mutation = missingArgument('mutation')) {
    schema.addFieldOptions(mutation, VALIDATE_MUTATION)
    const {name = missingArgument('name'), type = missingArgument('type'), typeDef, resolver} = mutation;
    if (typeDef) this._typeDefs.push(typeDef);
    this._mutations.push(mutation);
    if (resolver) this._getMutationResolver()[name] = resolver;
  }

  /**
   * Возвращает объект resolver для query данного уровня.
   */
  _getQueryResolver() {
    if (this._levelQueryResolver) return this._levelQueryResolver;
    const typeName = `${this.getTypeBaseName()}Query`;
    // чтобы apollo server дошёл до определенного уровня вложенности - нужно на верних уровнях запроса возвращать пустые объекты, которые буду заполнены ниже
    this._parentLevelBuilder._getQueryResolver()[this._name] = function () { return Object.create(null); };
    // в apollo server резловеры конкретного типа, находят в ветке первого уровня - имя типа
    return this._levelQueryResolver = this._resolvers[typeName] = Object.create(null);
  }

  /**
   * Возвращает объект resolver для mutation данного уровня.
   */
  _getMutationResolver() {
    if (this._levelMutationResolver) return this._levelMutationResolver;
    const typeName = `${this.getTypeBaseName()}Mutation`;
    // чтобы apollo server дошёл до определенного уровня вложенности - нужно на верних уровнях запроса возвращать пустые объекты, которые буду заполнены ниже
    this._parentLevelBuilder._getMutationResolver()[this._name] = function () { return Object.create(null); };
    // в apollo server резловеры конкретного типа, находят в ветке первого уровня - имя типа
    return this._levelMutationResolver = this._resolvers[typeName] = Object.create(null);
  }

  /**
   * Возвращает базовое имя типа.  Базовое, потому что к нему надо добавить Query, Mutations в зависимости от ситуации.
   */
  getTypeBaseName() {
    const parentName = this._parentLevelBuilder.getTypeBaseName();
    return `${parentName ? `${parentName}_` : ''}${this._name}`;
  }

  _builderFinished = () => {
    if (++this._buildersCompletedCount === this._builders.length) this._done();
  };

  async _runBuilders(options) {

    if (this._builders.length === 0) throw new Error('List of builders is empty');

    const {typeDefs, resolvers, context} = options;

    const donePromise = new Promise((resolve, reject) => {
      this._done = resolve;
    });

    const builderArgs = this._builderArgs = {parentLevelBuilder: this, typeDefs, resolvers, context};
    this._builders.forEach(builder => (builder instanceof LevelBuilder ? builder.build(builderArgs) : builder(builderArgs)).then(this._builderFinished));

    return donePromise; // ждем когда все билдеры сработают
  }

  /**
   *
   * @param parentLevelBuilder Объект класса GraphQLBuilder или просто метод build
   * @param typeDefs Коллекция фрагметов описания схемы
   * @param resolvers Объект резолверов
   * @returns {Promise.<*>} Когда процесс сборки закончен
   */
  async build(options) {
    schema.LevelBuilderBuildMethodOptions(options, validateArgumentNameOptions);

    const {parentLevelBuilder, typeDefs, resolvers} = options;

    this._parentLevelBuilder = parentLevelBuilder;
    this._typeDefs = typeDefs;
    this._resolvers = resolvers;

    await this._runBuilders(options);

    if (this._queries.length > 0) { // добавляем query поле в родительский билдер
      const typeName = `${this.getTypeBaseName()}Query`;
      const typeBuilder = new TypeBuilder({name: typeName});
      sortBy(this._queries, v => v.name);
      this._queries.forEach(v => typeBuilder.addField(v));
      parentLevelBuilder.addQuery({name: this._name, type: typeName, typeDef: typeBuilder.build()});
    }

    if (this._mutations.length > 0) { // добавляем mutation поле в родительский билдер
      const typeName = `${this.getTypeBaseName()}Mutation`;
      const typeBuilder = new TypeBuilder({name: typeName});
      sortBy(this._mutations, v => v.name);
      this._mutations.forEach(v => typeBuilder.addField(v));
      parentLevelBuilder.addMutation({name: this._name, type: typeName, typeDef: typeBuilder.build()});
    }
  }
}
