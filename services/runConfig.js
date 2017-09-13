import {missingArgument, invalidArgument} from '../utils/arguments'

const cache = new WeakMap();

/**
 * Возвращает метод, который возвращает одно и то же значние результата работы method(services), для данного объекта services и имени файла
 * @param name Строка, с именем файла - можно использовать или имя сервиса, или прямо __filename
 * @param method Метод который выполняет конфигурирование
 * @returns {*}
 */
export default function runConfig(name = missingArgument('name'), method = missingArgument('method')) {

  if (!(typeof name === 'string' && name.length > 0)) invalidArgument('name', name);
  if (!(typeof method === 'function')) invalidArgument('method', method);

  return function (services = missingArgument('services')) {

    if (!(typeof services === 'object' && services != null && !Array.isArray(services))) invalidArgument('services', services);

    let sv = cache.get(services);
    if (!sv)
      cache.set(services, sv = Object.create(null)); // создаем новый кеш объект для данного объекта services
    else if (name in sv) return; // этот метод для данного сочетания services и name уже выполнялся

    method(services); // выполняем шаг конфигурации
    sv[name] = true; // помечаем в кеше как true, чтобы не было повторного выполнения
  }
};
