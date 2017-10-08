import throwIfMissing from 'throw-if-missing'

export default class InvalidServiceStateError extends Error {
  /**
   * @param service Ссылка на объект-реализацию сервиса
   * @param state Состояние в котором находится сервис
   * @param err Если при этом был вызов метода сервиса, а потом он сменился с READY - то ошибка которую вернул метод
   */
  constructor({service = throwIfMissing('service'), state = throwIfMissing('state'), err}) {
    super(`'${service}': invalid state: '${state}'`);
    this.service = service;
    this.state = state;
    if (err) this.err = err;
  }
}
