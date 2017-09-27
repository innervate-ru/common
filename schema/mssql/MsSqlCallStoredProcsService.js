import {missingArgument, invalidArgument} from '../../validation'
import missingService from '../../services/missingService'
import oncePerServices from '../../services/oncePerServices'
import addServiceStateValidation from '../../services/addServiceStateValidation'
import prettyPrint from '../../utils/prettyPrint'
import addErrorContext from '../../utils/addErrorContext'
import tedious from 'tedious'

const TYPES = tedious.TYPES; // http://tediousjs.github.io/tedious/api-datatypes.html

const hasOwnProperty = Object.prototype.hasOwnProperty;
const schema = require('./MsSqlCallStoredProcsService.schema');

const debug = require('debug')('mssql');

export default oncePerServices(function (services) {

  /**
   * Базовый класс для сервисов, которые позволяют обращаться к хранимым процедурам, как к методам JScript объектов.
   *
   * У инстанса этого сервиса добавляются методы, на основе схемы переданной в конструктор.  Методы назваются так же, как
   * хранимые процедуры, к которым они обращаются.  Параметры процедур, как именнованные параметры методов.
   * Так же можно передавать специальные параметры _offset и _limit, чтоб выбрать какой диапозон данных нужно вернуть.
   *
   * Методы возвращают данные в том формате, в котором возвращает коннектор: {rows, hasNext, columns}
   */
  class MsSqlCallStoredProcsService {

    constructor(options) {
      schema.ctor_options(this, options);
      if (!(hasOwnProperty.call(services, options.connector))) missingService(options.connector);
      this._connector = services[options.connector];
    }

    _addMethods(schema = missingArgument('schema')) {
      if (!(Array.isArray(schema))) invalidArgument('schema', schema);
      processSchema.call(this, schema);
      addServiceStateValidation(this, function() { return this._service; });
    }
  }

  return MsSqlCallStoredProcsService;
})

function processSchema(schema) {
  let methodModel;
  try {
    for (methodModel of schema)
      addMethod.call(this, methodModel);
  } catch (error) {
    addErrorContext(`Method ${prettyPrint(methodModel)}`, error);
  }
}

function addMethod(model) {

  const addParamsToRequestBuilder = addParamsToRequestBuilderBuilder(model);
  const storedProcName = model.name;

  this[storedProcName] = /*async*/ function (args = {}) {

    const {_offset = 0, _limit = Number.MAX_SAFE_INTEGER, ...params} = args;

    return this._connector.callProcedure(storedProcName, {offset: _offset, limit: _limit, params: Object.keys(params).length > 0 ? addParamsToRequestBuilder(params) : null});
  }
}

function addParamsToRequestBuilderBuilder(model) {
  const paramsMap = Object.create(null);
  let parameterModel;
  try {
    for (parameterModel of model.params) {
      const parameterName = parameterModel.name;
      const SQLType = modelToMsSqlType(parameterModel);
      paramsMap[parameterName] = function (request, value) {
        request.addParameter(parameterName, SQLType, value);
      }
    }
  } catch (error) {
    addErrorContext(`Parameter '${model.name}'`, error);
  }
  return function (params) {
    return function (request) {
      for (const paramName in params) {
        if (!hasOwnProperty.call(params, paramName)) continue;
        if (!hasOwnProperty.call(paramsMap, paramName)) throw new Error(`Unexpected parameter '${paramName}'`);
        paramsMap[paramName](request, params[paramName]);
      }
    }
  }
}

function modelToMsSqlType(parameterModel) {
  if (parameterModel.mssqlType) {
    if (!hasOwnProperty(TYPES, parameterModel.mssqlType)) throw new Error(`Unknown MsSql type: '${prettyPrint(parameterModel.mssqlType)}'`);
    return TYPES[parameterModel.mssqlType];
  }
  switch (parameterModel.type) {
    case 'string':
      return TYPES.NVarChar;
    case 'int':
      return TYPES.Int;
    case 'bit':
      return TYPES.Bit;
    case 'float':
      return TYPES.Float;
    case 'date':
      return TYPES.DateTime;
  }
  throw new Error(`Unknown type: '${prettyPrint()}'`)
}
