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

      // вносим в схему отличия между методом в MS SQL и методом в GraphQL
      const gqlParams = {}, gqlFields = {}; // элементы graphQL схемы
      const {paramProcessors, resultProcessors, filterRows} = this._processMethod({
        ...args,
        methodName,
        method,
        methodOriginal,
        gqlParams,
        gqlFields
      });

      // параметры
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

      const methodArgs = [];
      for (const paramName in gqlParams) {
        const param = gqlParams[paramName];
        methodArgs.push({name: paramName, ...param});
      }

      // результат
      if (method.result)
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

      const rowType = new TypeBuilder({name: `${METHOD_PREFIX}Row`});
      for (const fieldName in gqlFields) {
        const field = gqlFields[fieldName];
        rowType.addField({name: fieldName, ...field});
      }
      typeDefs.push(rowType.build());

      const listType = new TypeBuilder({name: `${METHOD_PREFIX}List`});
      listType.addField({
        description: `true, когда указан параметр _limit и есть продолжение данных после того, что в rows`,
        name: 'hasNext',
        type: 'Boolean!',
      });
      listType.addField({
        description: `Данные возвращаемые методом ${method.name}`,
        name: 'rows',
        type: `[${rowType.name}!]!` ,
      });
      typeDefs.push(listType.build());

      const checkRights = (typeof this._checkRights == 'function') ? this._checkRights({
        methodName,
        method,
        serviceName,
      }) : null;

      // резолвер
      const resolver = async function (obj, args, gqlContext) {

        const {request, context} = gqlContext;

        const {_offset, _limit} = args;
        if (!(_offset == null || _offset >= 0)) throw new Error(`Argument '_offset': Must be positive or zero: ${_offset}`);
        if (!(_limit == null || _limit >= 0)) throw new Error(`Argument '_limit': Must be positive or zero: ${_limit}`);

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

        debug(`call service method %s(%O)`, methodName, methodParams);

        let {rows, hasNext} = await connector[methodName]({
          context,
          ...methodParams,
          _offset: _offset,
          _limit: _limit,
        });

        debug(`rows.length: %d, hasNext: %s`, rows.length, hasNext);

        if (filterRows) rows = filterRows.call(methodContext, rows);

        for (let rp of resultProcessors) {
          let promise = rp.call(methodContext, rows, request);
          if (typeof promise !== 'undefined') resultPromises.push(promise);
        }

        if (resultPromises.length > 0) await Promise.all(resultPromises);

        return {
          hasNext,
          rows,
        };
      };

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

    // добавляем поля _offset и _limit, пока во все методы, так как других вариантов, как возврат данных списком у нас пока нет
    gqlParams[`_offset`] = {
      description: `C какой строчки возвращать записи из результата запроса.  По умолчанию: 1`,
      type: `Int`,
    };
    gqlParams[`_limit`] = {
      description: `Сколько строк результата возвращать`,
      type: `Int`,
    };

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
