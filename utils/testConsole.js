import prettyPrint from './prettyPrint'

const defaultConsole = console;

/**
 * Имитатор консоли для использования в тестах.  Передавать в код сервисов как сервис console.
 */
export default class TestConsole {

  _log = '';

  log(data) {
    if (this._log.length > 0) this._log += ' | ';
    this._log += `log: ${printArgs(arguments)}`;
  }

  info(data) {
    if (this._log.length > 0) this._log += ' | ';
    this._log += `info: ${printArgs(arguments)}`;
  }

  error(data) {
    if (this._log.length > 0) this._log += ' | ';
    this._log += `error: ${printArgs(arguments)}`;
  }

  warn(data) {
    if (this._log.length > 0) this._log += ' | ';
    this._log += `warn: ${printArgs(arguments)}`;
  }

  getLogAndClear() {
    const res = this._log;
    this._log = '';
    return res;
  }

  dump(key) {
    if (key !== undefined)
      defaultConsole.info(key, this._log);
    else
      defaultConsole.info(this._log);
    this._log = '';
  }
}

function printArgs(args) {
  return Array.prototype.map.call(args, arg => prettyPrint(arg)).join(' ');
}
