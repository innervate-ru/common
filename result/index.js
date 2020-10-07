import {invalidArgument, tooManyArguments, reservedPropName, isResult} from '../validation/arguments'
import _index from './_index'
import _prop from './_prop'

export const _reservedAttrs = ['type', 'path', 'code', 'text'];

export function _combineMsg(type, path, code, args) {
  if (!((typeof type === 'undefined') || (typeof type === 'string' && type.length > 0))) {
    invalidArgument('type', type);
  }
  if (type) {
    if (!(type === 'error' || type === 'warn' || type === 'info')) {
      invalidArgument('type', type);
    }
  }
  if (!(!path || typeof path === 'string')) {
    invalidArgument('path', path);
  }
  if (!(typeof code === 'string' && code.length > 0)) {
    invalidArgument('code', code);
  }
  if (!((typeof args === 'undefined') || (typeof args === 'object' && args !== null))) {
    invalidArgument('args', args);
  }
  if (args) {
    for (const arg of _reservedAttrs) {
      if (args.hasOwnProperty(arg)) {
        reservedPropName(`args.${arg}`, args);
      }
    }
  }
  const msg = {};
  if (type && type !== 'info') {
    msg.type = type;
  }
  if (path) {
    msg.path = path;
  }
  msg.code = code;
  Object.assign(msg, args);
  return msg;
}

export default class Result {
  constructor(pathFuncOrResult) {
    if (!(arguments.length <= 1)) {
      tooManyArguments();
    }
    if (arguments.length === 0 || pathFuncOrResult === null) {
      this.pathFunc = function() {
        return '';
      };
    } else {
      if (isResult(pathFuncOrResult)) {
        this.parent = pathFuncOrResult;
        this.pathFunc = pathFuncOrResult.pathFunc || function() {
          return '';
        };
      } else if (typeof pathFuncOrResult === 'function' && pathFuncOrResult !== Result) { // with special protection from the case when instead of 'new Result', is written just 'Result'
        this.pathFunc = pathFuncOrResult;
      } else {
        invalidArgument('pathFuncOrResult', pathFuncOrResult);
      }
    }
    this.messages = [];
    this.isError = this._err = false;
  }

  log(typeOrMsg, pathFunc, code, args) {
    let msg;
    if (typeof typeOrMsg === 'object' && typeOrMsg !== null) {
      if (!typeOrMsg.hasOwnProperty('code')) {
        invalidArgument('typeOrMsg', typeOrMsg);
      }
      msg = typeOrMsg;
    } else {
      if (typeof pathFunc !== 'function') {
        [args, code, pathFunc] = [code, pathFunc, null];
      }
      let path = this.pathFunc('');
      if (pathFunc) {
        path = pathFunc(path);
      }
      msg = _combineMsg(typeOrMsg, path, code, args);
    }
    this.messages.push(msg);
    if (msg.type === 'error') {
      this.isError = this._err = true;
    }
    return msg;
  }

  error(pathFunc, code, args) {
    return this.log('error', pathFunc, code, args); // error: (code, args) ->
  }

  warn(pathFunc, code, args) {
    return this.log('warn', pathFunc, code, args); // warn: (code, args) ->
  }

  info(pathFunc, code, args) {
    return this.log('info', pathFunc, code, args); // info: (code, args) ->
  }

  add(result) {
    if (!isResult(result)) {
      invalidArgument('result', result);
    }
    if (result.messages.length > 0) {
      Array.prototype.push.apply(this.messages, result.messages);
      this.isError = this.isError || result.isError;
      result.reset();
    }
    return this;
  }

  reset() {
    this.isError = false;
    this.messages.length = 0;
  }

  context(pathFunc, body) {
    if (!(arguments.length <= 2)) {
      tooManyArguments();
    }
    if (arguments.length === 1) {
      [body, pathFunc] = [pathFunc, this.pathFunc];
    }
    if (typeof pathFunc !== 'function') {
      invalidArgument('pathFunc', pathFunc);
    }
    if (typeof body !== 'function') {
      invalidArgument('body', body);
    }
    return ((oldIsError, oldErr, oldPathFunc) => { // context:
      this.isError = this._err = false;
      this.pathFunc = function(path) {
        return pathFunc(oldPathFunc(path));
      };
      const res = body();
      this.isError = this._err || oldIsError;
      this._err = this._err || oldErr;
      this.pathFunc = oldPathFunc;
      return res;
    })(this.isError, this._err, this.pathFunc);
  }

  throwIfError() {
    if (this.isError) {
      const err = new Error(JSON.stringify(this.messages));
      err.code = 'dsc.result';
      this.reset(); // so global Result object could be reused in specs
      throw err;
    } else {
      this.reset();
    }
  }
}

Result.index = _index;

Result.prop = _prop;
