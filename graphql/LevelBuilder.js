import {missingArgument, invalidArgument} from '../utils/arguments'
import sortBy from 'lodash/sortBy'
import TypeBuilder from './TypeBuilder'
import wrapResolver from './wrapResolver'

const BUILDER_TAKES_TOO_LONG_INTERVAL = 20000;

const schema = require('./LevelBuilder.schema');

/**
 * Хотя apollo-server позволяет задавать схему как набор отдельных фрагментов, и позволяет делать 'extend type' - http://dev.apollodata.com/tools/graphql-tools/generate-schema.html#extend-types
 *
 * Однако проблема в том, что нельзя определить тип без полей и методов, и это делает extend type достаточно бесполезным для создания объединяющих типов, например: cyberlines, data ...
 * Поэтому возникла идея сделать билдер, который будет генерировать родительский тип, только если в него ранее добавили query и/или mutations.
 */
export default class LevelBuilder {

  // копируются из options конструктора
  _name; // имя уровня
  _description; // описание сервиса для graphql схемы

  _queries = []; // список query, которые добавили билдеры
  _mutations = []; // список mutation, которые добавили билдеры

  _builders = []; // список билдеров вложенных в этот уровень.  это могут объекты LevelBuilder или конечные билдеры, получающие {parentLevelBuilder, typeDefs, resolvers}
  _buildersCompletedCount = 0; // количество билдеров завершивших работу.  когда совпадает с длиной _builders, означает что можно завершать билдер этого объекта

  _parentLevelBuilder; // билдер, в который этот объект добавляет свой query и свой mutation, при условии что они получились не пустыми
  _typeDefs; // общий список типов, который потом отдается в схему apollo graphql
  _resolvers; // корневой объект resolvers, который можно добавлять резолверы типа: _resolvers[<typeName>][<queryName>] = (obj, args, builderContext) => {}

  _levelQueryResolver; // объект с query резолверами, для этого уровня
  _levelMutationResolver; // объект с mutation резолверами, для этого уровня

  _builderArgs; // аргументы, который передаются билдерам из _builders[].  они одинаковые для всех билдеров из списка
  _done; // resolve() для промиса, который возвращает метод build(...)
  _reject; // reject() для промиса, который возвращает метод build(...)

  constructor(options) {
    schema.ctor_options(this, options);
  }

  addBuilder(builder = missingArgument('builder')) {
    if (!(builder instanceof LevelBuilder || typeof builder === 'function')) invalidArgument('builder', builder);
    this._builders.push(builder);
    if (this._done) { // добавление билдера в момент, когда уже this.build() вызван
      // TODO: Fix this
      // if (this._done.isFulfilled) throw new Error(`Invalid state: this.build() is already completed, and it's too later to add a new builder`);
      builder.build(this._builderArgs).then(_builderFinished);
    }
    return this;
  }

  /**
   * Добавляет запрос graphql в тип, который этот билдер собирает.
   *
   * @param name Название поля/метода
   * @param args Массив строк, где каждая строка соотвествует аргументу ...или просто строка с аргументами через заяпятую внутри
   * @param type Тип поля/метода
   */
  addQuery(query = missingArgument('query')) {
    schema.addQuery_query(query)
    const {name = missingArgument('name'), type = missingArgument('type'), typeDef, resolver} = query;
    if (typeDef) this._typeDefs.push(typeDef);
    this._queries.push(query);
    if (resolver) this._getQueryResolver()[name] = wrapResolver(resolver);
    return this;
  }

  /**
   * Добавляет запрос graphql в тип, который этот билдер собирает.
   *
   * @param name Название поля/метода
   * @param args Массив строк, где каждая строка соотвествует аргументу ...или просто строка с аргументами через заяпятую внутри
   * @param type Тип поля/метода
   */
  addMutation(mutation = missingArgument('mutation')) {
    schema.addMutation_mutation(mutation);
    const {name = missingArgument('name'), type = missingArgument('type'), typeDef, resolver} = mutation;
    if (typeDef) this._typeDefs.push(typeDef);
    this._mutations.push(mutation);
    if (resolver) this._getMutationResolver()[name] = wrapResolver(resolver);
    return this;
  }

  /**
   * Добавляет описание уровня.
   */
  setDescription(description = missingArgument('description')) {
    if (!(typeof description === 'string' && description.length > 0)) invalidArgument('description', description);
    this._description = description;
    return this;
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
    if (++this._buildersCompletedCount === this._builders.length && this._done) this._done(); // если _done нет, значит случилась ошибка
  };

  _builderFailed = (error) => {
    if (this._reject) {
      this._reject(error);
      this._reject = this._done = null;
    }
  };

  async _runBuilders(options) {

    if (this._builders.length === 0) return;

    const {bus, typeDefs, resolvers, builderContext, parentLevelName} = options;

    const levelName = (parentLevelName ? `${parentLevelName}.` : '') + this._name;

    const donePromise = new Promise((resolve, reject) => {
      this._done = () => {
        const r = {name: this._name, startTime: Date.now() - startTime}; // возвращаем время, которое работала данная ветка
        if (stat) {
          r.stat = stat;
        }
        resolve(r);
      };
      this._reject = reject;
    });

    const startTime = Date.now();

    let stat;

    const builderArgs = this._builderArgs = {bus, parentLevelBuilder: this, typeDefs, resolvers, parentLevelName: levelName, builderContext};

    this._builders.forEach(
      builder => {
        const isLevelBuilder = builder instanceof LevelBuilder;
        let build = isLevelBuilder ? builder.build(builderArgs) : builder(builderArgs);

        if (bus && !isLevelBuilder) {
          const timer = setInterval(() => {
            bus.info({
              type: 'graphql.builderTakesTooLong',
              service: 'graphql',
              name: levelName,
              duration: Date.now() - startTime,
            });
          }, BUILDER_TAKES_TOO_LONG_INTERVAL);
          build = build.then(data => {
            clearInterval(timer);
            return data;
          });
        }

        build
          .then(data => {
            if (data) { // время доступно только для уровней с LevelBulder.  Вложенные билдеры не измеряем
              const {name, ...rest} = data;
              (stat || (stat = Object.create(null)))[data.name] = rest;
            }
            this._builderFinished();
          })
          .catch(this._builderFailed);
      });


    return donePromise; // ждем когда все билдеры сработают
  }

  async build(options) {
    schema.build_options(options);

    const {parentLevelBuilder, typeDefs, resolvers} = options;

    this._parentLevelBuilder = parentLevelBuilder;
    this._typeDefs = typeDefs;
    this._resolvers = resolvers;

    const stat = await this._runBuilders(options);

    if (this._queries.length > 0) { // добавляем query поле в родительский билдер
      const typeName = `${this.getTypeBaseName()}Query`;
      const typeBuilder = new TypeBuilder({name: typeName, description: this._description});
      sortBy(this._queries, v => v.name);
      this._queries.forEach(v => typeBuilder.addField(v));
      parentLevelBuilder.addQuery({description: this._description, name: this._name, type: typeName, typeDef: typeBuilder.build()});
    }

    if (this._mutations.length > 0) { // добавляем mutation поле в родительский билдер
      const typeName = `${this.getTypeBaseName()}Mutation`;
      const typeBuilder = new TypeBuilder({name: typeName, description: this._description});
      sortBy(this._mutations, v => v.name);
      this._mutations.forEach(v => typeBuilder.addField(v));
      parentLevelBuilder.addMutation({description: this._description, name: this._name, type: typeName, typeDef: typeBuilder.build()});
    }

    return stat;
  }
}
