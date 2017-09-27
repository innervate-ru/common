import throwIfMissing from 'throw-if-missing'

import parseXml from '../utils/parseXml'

import InvalidSchemaException from './InvalidSchemaException'

import wrapResolver from '../graphql/wrapResolver'

import cloneDeep from 'lodash/cloneDeep'

import {connectionArgs, connectionDefinitions, toGlobalId, offsetToCursor, getOffsetWithDefault} from 'graphql-relay'

import {
  GraphQLObjectType,
  GraphQLBoolean,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLList,
  GraphQLID,
} from 'graphql'

const debug = require('debug')('graphql');

const rootQueries = {}, rootMutations = {};

/**
 * Базовый класс для формирования graphQl схемы на основе описания метода.
 */
export default class SchemaToGraphQL {

  /**
   *
   * @param serviceName Перфик для названия query/mutation в graphQL.  Например: 'cyberlines'
   */
  constructor({serviceName = throwIfMissing('serviceName')}) {
    this._serviceName = serviceName || '';
  }

  // TODO: + Добавить имя типа для global_id ...точнее включить его в схему
  // TODO: Отличаются оформления аргументов для query и mutation
  // TODO: + Добавить игнорирование полей
  // TODO: Добавить поддержку типа input для mutation
  // TODO: Добавить поддержку mutationId для mutation
  // TODO: Сделать вывод списка в формате connection
  // TODO: + Скопировать description для graphQL
  // TODO: В конце проверить, что код работает для генерации схемы для клиента
  // TODO: Добавить поддержку для non-null и required параметров

  /**
   * Метод для конкретного метода коннектора из схемы, выполняет следующие операции:
   * - строит query или mutaion, если указан gqlType в методе
   * - возвращает метод для подготовки парамеров из graphQl параметров.
   * - возвращает метод для подготовки данных для возврата через graphQl.
   *
   * @param {object} service Конектор, через который будет выполняться запрос к БД (Например ./src/services/cyberlines).
   * @param {object} method Описание схемы {имя, параметры, колонки в результате} метода, который будем вызывать у коннетора.   *
   * @param {object} types Коллекция общих graphQL типов, которые могут использоваться в нескольких местах схемы.
   * @param {object} queries Коллекция корневых graphQL запросов.
   * @param {object} mutations Коллекция корневых graphQL методов для изменения данных.
   * @returns {{paramProcessors: *, resultProcessors: *}} - paramProcessors - Функция обработки параметров; resultProcessors - Функция обработки результата.
   */
  build({
    service = throwIfMissing('service'),
    method = throwIfMissing('method'),
    types = throwIfMissing('types'),
    queries = throwIfMissing('queries'),
    mutations = throwIfMissing('mutations')
  }) {

    switch (method.gqlType) {
      case 'query':
      case 'mutation':
        this._type = method.gqlType;
        break;
      default:
        return; // этот метод не должен быть виден через graphQL
    }

    // копируем описание метода, чтобы далее описание можно было модифицировать
    let methodOriginal = method;
    method = cloneDeep(methodOriginal);

    let anyError = false;

    const methodName = method.name;

    const gqlParams = {}, gqlFields = {}; // элементы graphQL схемы
    const {paramProcessors, resultProcessors, filterRows} = this._processMethod({
      methodName,
      method,
      methodOriginal,
      serviceName: this._serviceName,
      types,
      gqlParams,
      gqlFields
    });

    for (let param of method.params) {
      try {
        let paramProcessor = this._processParam({
          methodName,
          method,
          serviceName: this._serviceName,
          types,
          param,
          gqlParams
        });
        if (typeof paramProcessor == 'function') paramProcessors.push(paramProcessor);
      } catch (err) {
        if (!(err instanceof InvalidSchemaException)) throw err;
        anyError = true;
      }
    }

    if (method.result)
      for (let field of method.result) {
        try {
          let resultProcessor = this._processResult({
            methodName,
            method,
            serviceName: this._serviceName,
            types,
            field,
            gqlFields
          });
          if (typeof resultProcessor == 'function') resultProcessors.push(resultProcessor);
        } catch (err) {
          if (!(err instanceof InvalidSchemaException)) throw err;
          anyError = true;
        }
      }

    let serviceQueries, serviceMutations;
    let hasRows = true;

    switch (this._type) {
      case 'query': {

        let rowType = `${methodName}Row`;

        let resultType = types[rowType] = new GraphQLObjectType({
          name: rowType,
          fields: gqlFields,
        });

        const {connectionType} = connectionDefinitions({
          name: rowType,
          nodeType: resultType,
        });

        if (rootQueries.hasOwnProperty(this._serviceName))
          serviceQueries = rootQueries[this._serviceName];
        else {
          // Такая вложенность потребовалась, так как Relay не поддерживает больше одного аргумента для query
          // Proof: https://github.com/facebook/relay/issues/112
          queries[this._serviceName] = {
            name: `${this._serviceName}`,
            description: `Запросы (queries) сервиса '${this._serviceName}'`,
            type: new GraphQLObjectType({
              name: `${this._serviceName}Queries`,
              fields: serviceQueries = rootQueries[this._serviceName] = {},
            }),
          }
        }

        serviceQueries[methodName] = {
          name: methodName,
          description: method.description,
          args: gqlParams,
          type: new GraphQLObjectType({
            name: `${methodName}Result`,
            fields: {
              rows: {args: connectionArgs, type: connectionType},
            }
          }),
        };
        break;
      }
      case 'mutation': {

        let _connectionType;

        if (Object.keys(gqlFields).length > 0) { // mutation может ничего не возвращать

          // Totally copied from 'query' // TODO: Remove duplication
          let rowType = `${methodName}Row`;

          let resultType = new GraphQLObjectType({
            name: rowType,
            fields: gqlFields,
          });

          const {connectionType} = connectionDefinitions({
            name: rowType,
            nodeType: resultType,
          });

          _connectionType = connectionType;
        } else hasRows = false;

        if (rootMutations.hasOwnProperty(this._serviceName))
          serviceMutations = rootMutations[this._serviceName];
        else {
          // Такая вложенность потребовалась, так как Relay не поддерживает больше одного аргумента для query
          // Proof: https://github.com/facebook/relay/issues/112
          mutations[this._serviceName] = {
            name: `${this._serviceName}`,
            description: `Запросы (queries) сервиса '${this._serviceName}'`,
            type: new GraphQLObjectType({
              name: `${this._serviceName}Mutations`,
              fields: serviceMutations = rootMutations[this._serviceName] = {},
            }),
          }
        }

        if (_connectionType) {
          serviceMutations[methodName] = {
            name: methodName,
            description: method.description,
            args: gqlParams,
            type: new GraphQLObjectType({
              name: `${methodName}Result`,
              fields: {
                rows: {args: connectionArgs, type: _connectionType},
              }
            }),
          };
        } else {
          serviceMutations[methodName] = {
            name: methodName,
            description: method.description,
            args: gqlParams,
            type: new GraphQLObjectType({
              name: `${methodName}Result`,
              fields: {
                result: {type: GraphQLString}, // Пока всегда null // TODO: Вернуть значение из метода
              }
            }),
          };
        }
        break;
      }
      default:
        throw new Error('Unexpected');
    }

    if (serviceQueries) {
      queries[this._serviceName] = {
        name: `${this._serviceName}`,
        description: `Запросы сервиса '${this._serviceName}'`,
        type: new GraphQLObjectType({
          name: `${this._serviceName}Queries`,
          fields: serviceQueries,
        }),
      }
    }

    if (serviceMutations) {
      mutations[this._serviceName] = {
        name: `${this._serviceName}`,
        description: `Запросы сервиса '${this._serviceName}'`,
        type: new GraphQLObjectType({
          name: `${this._serviceName}Mutations`,
          fields: serviceMutations,
        }),
      }
    }

    if (anyError) throw new InvalidSchemaException();

    let checkRights = (typeof this._checkRights == 'function') ? this._checkRights({
      methodName,
      method,
      serviceName: this._serviceName
    }) : null;

    return {
      serviceName: this._serviceName,
      methodName,
      resolver: wrapResolver(async function (args = throwIfMissing('args'), request = throwIfMissing('request')) {

        debug('method %s(%o)', methodName, args);

        let context = {}, paramsPromises = [], resultPromises = [];

        let methodParams = {};

        let fixedArgs = {...args};

        if (checkRights) checkRights.call(context, methodName, fixedArgs, request);

        for (let pp of paramProcessors) {
          let promise = pp.call(context, methodParams, fixedArgs, request);
          if (typeof promise != 'undefined') paramsPromises.push(promise);
        }

        if (paramsPromises.length > 0) await Promise.all(paramsPromises);

        return {
          rows: wrapResolver(async function ({before, after, first, last}) {

            let startOffset = getOffsetWithDefault(after, -1) + 1;
            let endOffset = getOffsetWithDefault(before, Number.MAX_SAFE_INTEGER) - 1;

            debug(`w/o first and last: startOffset: %d, endOffset: %d`, startOffset, endOffset);

            if (typeof first === 'number') {
              if (first < 0) {
                throw new Error('Argument "first" must be a non-negative integer');
              }
              endOffset = Math.min(endOffset, startOffset + first - 1);
            }
            if (typeof last === 'number') {
              if (last < 0) {
                throw new Error('Argument "last" must be a non-negative integer');
              }
              startOffset = Math.max(startOffset, endOffset - last + 1);
            }

            debug(`with first and last: startOffset: %d, endOffset: %d`, startOffset, endOffset);

            if (endOffset >= startOffset) {

              debug(`call service method %s(%O)`, methodName, methodParams);

              let {rows, hasNext} = await service[methodName]({
                ...methodParams,
                _fromRow: startOffset,
                _toRow: endOffset
              });

              debug(`rows.length: %d, hasNext: %s`, rows.length, hasNext);

              if (filterRows) rows = filterRows.call(context, rows);

              for (let rp of resultProcessors) {
                let promise = rp.call(context, rows, request);
                if (typeof promise != 'undefined') resultPromises.push(promise);
              }

              if (resultPromises.length > 0) await Promise.all(resultPromises);

              let index = startOffset;
              let edges = [];
              for (let row of rows)
                edges.push({
                  cursor: offsetToCursor(startOffset + index++),
                  node: row,
                })

              return {
                pageInfo: {
                  hasNextPage: hasNext,
                  hasPreviousPage: startOffset > 0,
                  startCursor: offsetToCursor(startOffset),
                  endCursor: offsetToCursor(endOffset),
                },
                edges
              };
            }
          }),
        };
      })
    };
  }

  /**
   * Обрабатывает и модифицирует описание метода.  Этот метод не создает элементов схемы или обрабтотки данных.
   *
   * @param {string} methodName
   * @param {object} method - Описание метода, которое может быть изменено этим методом.
   * @param {object} methodOriginal
   * @param {object} gqlParams
   * @param {object} gqlFields
   * @returns {{paramProcessors: Array, resultProcessors: Array}}
   * @private
   */
  _processMethod({methodName, method, methodOriginal, gqlParams, gqlFields}) {

    let paramProcessors = [], resultProcessors = [];

    let globalIdField, globalIdType;

    // удаляем параметры помеченные как gqlHide = true
    for (let i = method.params.length - 1; i >= 0; i--) {
      var param = method.params[i];
      if (param.gqlHide)
        method.params.splice(i, 1);
    }

    // удаляем колонки результата помеченные как gqlHide = true
    if (method.result)
      for (let i = method.result.length - 1; i >= 0; i--) {
        var field = method.result[i];
        if (field.gqlHide)
          method.result.splice(i, 1);
        // из параметра gqlID берем имя типа объекта для globalID
        if (field.gqlID) {
          globalIdType = field.gqlID;
          globalIdField = field.name;
        }
      }

    // если было поле, помеченное gqlID, то добавляем поле id
    if (globalIdField) {
      for (let field of methodOriginal.result) {
        if (field.name == 'id') {
          console.error(`Method '${method.name}': Cannot generated globalId from field '${globalIdField}': Field 'id' is already in method result`);
          throw new InvalidSchemaException();
        }
      }

      gqlFields['id'] = {
        type: new GraphQLNonNull(GraphQLID),
      };

      resultProcessors.push(function (result, request) {
        for (let row of result) {
          row['id'] = toGlobalId(globalIdType, `${row[globalIdField]}`);
        }
      });
    }

    if (methodOriginal.result)
      methodOriginal.result.filter(v => v.type == 'xml').forEach(field => {
        gqlFields[`${field.name}__json`] = {
          type: GraphQLString,
        }
      });

    return {paramProcessors, resultProcessors};
  }

  /**
   * Добавляет параметр в схему, и возвращает метод для обработки параметра.
   *
   * @param {string} methodName
   * @param {object} method
   * @param {object} param
   * @param {object} gqlParams
   * @returns {Function}
   * @private
   */
  _processParam({
    methodName = throwIfMissing('methodName'),
    method = throwIfMissing('method'),
    param = throwIfMissing('param'),
    gqlParams = throwIfMissing('gqlParams'),
  }) {
    gqlParams[param.name] = {
      description: param.description,
      type: convertTypeToGqlType({methodName, method, param}),
    };

    const paramName = param.name;
    const paramRequred = param.required;

    if (param.type == 'date') {
      return function (methodArgs, gqlArgs, request) {
        if (gqlArgs.hasOwnProperty(paramName)) {
          const v = gqlArgs[paramName];
          methodArgs[paramName] = v == null ? null : new Date(v);
        } else if (paramRequred)
          throw new Error(`Missing required parameter: '${paramName}'`);
      };
    }

    return function (methodArgs, gqlArgs, request) {
      if (gqlArgs.hasOwnProperty(paramName))
        methodArgs[paramName] = gqlArgs[paramName];
      else if (paramRequred)
        throw new Error(`Missing required parameter: '${paramName}'`);
    };
  }

  /**
   * Добавляет в graphQL схему поле результата. И возвращает метод для подготовки поля к возврату через graphQL интерфейс.
   *
   * @param {string} methodName
   * @param {object} method
   * @param {object} field
   * @param {object} gqlFields
   * @returns {function} метод для подготовки поля к возврату через graphQL интерфейс
   * @private
   */
  _processResult({
    methodName = throwIfMissing('methodName'),
    method = throwIfMissing('method'),
    field = throwIfMissing('field'),
    gqlFields = throwIfMissing('gqlFields'),
  }) {
    gqlFields[field.name] = {
      description: field.description,
      type: convertTypeToGqlType({methodName, method, field}),
    };
    if (field.type == 'date') {
      let fieldName = field.name;
      return function (rows) {
        for (let row of rows)
          row[fieldName] = row[fieldName] && row[fieldName].toISOString();
      }
    }
    if (field.type == 'bit') {
      let fieldName = field.name;
      return function (rows) {
        for (let row of rows)
          row[fieldName] = !!row[fieldName];
      }
    }
    if (field.type == 'xml') {
      const xmlFieldName = field.name;
      const jsonFieldName = `${field.name}__json`;
      return function (rows) {
        for (const row of rows) {
          const xml = row[xmlFieldName];
          if (xml) row[jsonFieldName] = wrapResolver(
            async function () {
              return JSON.stringify(await parseXml(`<data>${xml}</data>`));
            });
        }
      }
    }
    return null; // по умолчанию обработки нет
  }
}

/**
 * Стандартное приобразование типов в схеме в graphQL типы.
 *
 * @param methodName - префикс для имен типов связанных с методом.
 * @param method - описание метода (схема).
 * @param param - описание параметра, если преобразование типа выполняется для параметра.
 * @param field - описание поля результата, если преобразование типа выполняется для поля результата.
 */
function convertTypeToGqlType({
  methodName = throwIfMissing('methodName'),
  method = throwIfMissing('method'),
  param, field, // один из параметров
}) {
  const type = (param || field).type;
  switch (type) {
    case 'string':
      return GraphQLString;
    case 'xml':
      return GraphQLString;
    case 'int':
      return GraphQLInt;
    case 'bit':
      return GraphQLBoolean;
    case 'float':
      return GraphQLFloat;
    case 'bool':
      return GraphQLBoolean;
    case 'date':
      return GraphQLString;
    default:
      console.error(`Method '${method.name}': ${param ? `Parameter '${param.name}'` : `Field ${field.name}`}: Unknown type: '${type}'`);
      throw new InvalidSchemaException();
  }
}
