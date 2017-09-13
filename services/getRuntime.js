import {missingArgument, invalidArgument} from '../utils/arguments'

const cache = new WeakMap();

/**
 * Возвращает одно и то же значние результата работы method(services), для данного объекта services и имени файла
 * @param name Строка, с именем файла - можно использовать или имя сервиса, или прямо __filename
 * @param method Метод
 * @returns {*}
 */
export default function getRuntime(name = missingArgument('name'), method = missingArgument('method')) {

  if (!(typeof method === 'function')) invalidArgument('method', method);
  if (!(typeof name === 'string' && name.length > 0)) invalidArgument('name', name);

  return function (services = missingArgument('services')) {

    if (!(typeof services === 'object' && services != null && !Array.isArray(services))) invalidArgument('services', services);

    let sv = cache.get(services);
    if (!sv)
      cache.set(services, sv = Object.create(null)); // создаем новый кеш объект для данного объекта services
    else if (name in sv)
      return sv[name]; // и в нем есть результат для данного name

    return sv[name] = method(services); // сохраняем значение в кеше и возвращаем как результат
  }
};
