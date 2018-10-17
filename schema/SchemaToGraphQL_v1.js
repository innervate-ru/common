import cloneDeep from 'lodash/cloneDeep'
import TypeBuilder from '../graphql/TypeBuilder'
import wrapResolver from '../graphql/wrapResolver'
import addPrefixToErrorMessage from '../utils/addPrefixToErrorMessage'
import convertTypeToGqlType from './convertTypeToGqlType'
import parseXml from '../utils/parseXml'

const hasOwnProperty = Object.prototype.hasOwnProperty;

const schema = require('./SchemaToGraphQL.schema');

const debug = require('debug')('graphql');

// Ниже код, взятый из node_modules/graphql-relay/lib/connection/arrayconnection.js библиотеки relay graphql

var ARRAY_PREFIX = 'arrayconnection:';

function getOffsetWithDefault(cursor, defaultOffset) {
  if (typeof cursor !== 'string') {
    return defaultOffset;
  }
  var offset = cursorToOffset(cursor);
  return isNaN(offset) ? defaultOffset : offset;
}

function cursorToOffset(cursor) {
  return parseInt(new Buffer(cursor, 'base64').toString('utf8').substring(ARRAY_PREFIX.length), 10);
}

function offsetToCursor(offset) {
  return new Buffer(ARRAY_PREFIX + offset, 'utf8').toString('base64');
}

function toGlobalId(type, id) {
  return new Buffer([type, id].join(':'), 'utf8').toString('base64');
}

/////////////

export default class SchemaToGraphQL {

  build(args) {

    require('./SchemaToGraphQL.schema').build_args(args);

    const {parentLevelBuilder, typeDefs, builderContext, PREFIX, serviceName, connector} = args;
    let {method} = args;

    parentLevelBuilder.setDescription(`Методы сервиса ${serviceName}`);

    try {

      const METHOD_PREFIX = `${PREFIX}${method.name}`;

      // копируем описание метода, чтобы далее описание можно было модифицировать
      let methodOriginal = method;
      method = cloneDeep(methodOriginal);

      const methodName = method.name;

      const gqlParams = {}, gqlFields = {}; // элементы graphQL схемы
      const {paramProcessors, resultProcessors, filterRows} = this._processMethod({
        ...args,
        methodName,
        method,
        methodOriginal,
        gqlParams,
        gqlFields
      });

      for (const param of method.params) {
        const paramProcessor = this._processParam({
          ...args,
          methodName,
          method,
          param,
          gqlParams
        });
        if (typeof paramProcessor == 'function') paramProcessors.push(paramProcessor);
      }

      if (method.result) {
        for (const field of method.result) {
          const resultProcessor = this._processResult({
            ...args,
            methodName,
            method,
            field,
            gqlFields
          });
          if (typeof resultProcessor == 'function') resultProcessors.push(resultProcessor);
        }
      }

      // это повторение иерархии типов из relay-graphql connection
      const pageInfoType = `${PREFIX}PageInfo`;
      if (!builderContext[pageInfoType]) { // from node_modules/graphql-relay/lib/connection/connection.js (112)
        builderContext[pageInfoType] = true;
        const connectionPageInfo = new TypeBuilder({
          name: `PageInfo`,
          description: `Information about pagination in a connection.`
        });
        connectionPageInfo.addField({
          name: `hasNextPage`,
          type: `Boolean!`,
          description: `When paginating forwards, are there more items?`
        });
        connectionPageInfo.addField({
          name: `hasPreviousPage`,
          type: `Boolean!`,
          description: `When paginating backwards, are there more items?`
        });
        connectionPageInfo.addField({
          name: `startCursor`,
          type: `String`,
          description: `When paginating backwards, the cursor to continue.`
        });
        connectionPageInfo.addField({
          name: `endCursor`,
          type: `String`,
          description: `When paginating forwards, the cursor to continue.`
        });
        typeDefs.push(connectionPageInfo.build());
      }

      const rowType = new TypeBuilder({name: `${METHOD_PREFIX}Row`});
      for (const fieldName in gqlFields) {
        const field = gqlFields[fieldName];
        rowType.addField({name: fieldName, ...field});
      }
      typeDefs.push(rowType.build());

      const edgeType = new TypeBuilder({name: `${METHOD_PREFIX}Edge`, description: `An edge in a connection.`});
      edgeType.addField({
        name: `node`,
        type: rowType.name,
        description: `The item at the end of the edge`
      });
      edgeType.addField({name: `cursor`, type: `String!`, description: `A cursor for use in pagination`});
      typeDefs.push(edgeType.build());

      const connectionType = new TypeBuilder({
        name: `${METHOD_PREFIX}Connection`,
        description: `A connection to a list of items.`
      });
      connectionType.addField({
        name: `pageInfo`,
        type: `PageInfo!`,
        description: `Information to aid in pagination.`
      });
      connectionType.addField({name: `edges`, type: `[${edgeType.name}]`, description: `A list of edges.`});
      typeDefs.push(connectionType.build());

      const listType = new TypeBuilder({name: `${METHOD_PREFIX}List`});
      listType.addField({
        name: 'rows',
        args: [
          {name: 'after', type: 'String'},
          {name: 'first', type: 'Int'},
          {name: 'before', type: 'String'},
          {name: 'last', type: 'Int'},
        ],
        type: connectionType.name,
      });
      typeDefs.push(listType.build());

      const checkRights = (typeof this._checkRights == 'function') ? this._checkRights({
        methodName,
        method,
        serviceName,
      }) : null;

      const resolver = async function (obj, args, gqlContext) {

        const {request, context} = gqlContext;

        debug('method %s(%o)', methodName, args);

        let methodContext = {}, paramsPromises = [], resultPromises = [];

        let methodParams = {};

        let fixedArgs = {...args};

        if (checkRights) checkRights.call(methodContext, methodName, fixedArgs, request);

        for (let pp of paramProcessors) {
          let promise = pp.call(methodContext, methodParams, fixedArgs, request);
          if (typeof promise !== 'undefined') paramsPromises.push(promise);
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

              let {rows, hasNext} = await connector[methodName]({
                context,
                ...methodParams,
                _offset: startOffset,
                _limit: endOffset - startOffset + 1,
              });

              debug(`rows.length: %d, hasNext: %s`, rows.length, hasNext);

              if (filterRows) rows = filterRows.call(methodContext, rows);

              for (let rp of resultProcessors) {
                let promise = rp.call(methodContext, rows, request);
                if (typeof promise !== 'undefined') resultPromises.push(promise);
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
      };

      const methodArgs = [];
      for (const paramName in gqlParams) {
        const param = gqlParams[paramName];
        methodArgs.push({name: paramName, ...param});
      }

      parentLevelBuilder[method.gqlType === 'mutation' ? 'addMutation' : 'addQuery']({
        description: method.description,
        name: methodName,
        args: methodArgs,
        type: listType.name,
        resolver,
      });

    } catch (error) {
      addPrefixToErrorMessage(`Method '${method.name}'`, error);
    }
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
        if (field.name == 'id')
          throw new Error(`Method '${method.name}': Cannot generated globalId from field '${globalIdField}': Field 'id' is already in method result`);
      }

      gqlFields['id'] = {
        type: 'ID!',
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
          type: 'String',
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
    const paramName = param.name;
    const paramRequred = param.required;
    try {

      gqlParams[paramName] = {
        description: param.description,
        type: `${convertTypeToGqlType({methodName, method, type: param.type})}${paramRequred ? '!' : ''}`,
      };

      if (param.type == 'date') {
        return function (methodArgs, gqlArgs, request) {
          if (hasOwnProperty.call(gqlArgs, paramName)) {
            const v = gqlArgs[paramName];
            methodArgs[paramName] = v == null ? null : new Date(v);
          } else if (paramRequred)
            throw new Error(`Missing required parameter: '${paramName}'`);
        };
      }

      return function (methodArgs, gqlArgs, request) {
        if (hasOwnProperty.call(gqlArgs, paramName))
          methodArgs[paramName] = gqlArgs[paramName];
        else if (paramRequred)
          throw new Error(`Missing required parameter: '${paramName}'`);
      };
    } catch (error) {
      addPrefixToErrorMessage(`Parameter '${paramName}'`, error);
    }
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
    const fieldName = field.name;
    try {
      gqlFields[fieldName] = {
        description: field.description,
        type: convertTypeToGqlType({methodName, method, type: field.type}),
      };
      if (field.type == 'date') {
        let fieldName = fieldName;
        return function (rows) {
          for (let row of rows)
            row[fieldName] = row[fieldName] && row[fieldName].toISOString();
        }
      }
      if (field.type == 'bit') {
        let fieldName = fieldName;
        return function (rows) {
          for (let row of rows)
            row[fieldName] = !!row[fieldName];
        }
      }
      if (field.type == 'xml') {
        const xmlFieldName = fieldName;
        const jsonFieldName = `${fieldName}__json`;
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
    } catch (error) {
      addPrefixToErrorMessage(`Result field '${fieldName}'`, error);
    }
  }
}
