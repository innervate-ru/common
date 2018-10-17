import {missingArgument, invalidArgument} from '../utils/arguments'

const cache = new WeakMap();

/**
 * Возвращает одно и то же значние результата работы method(services), для одного и того же объекта services и одного и того же метода.
 */
export default function oncePerServices(method = missingArgument('method')) {

  if (!(typeof method === 'function')) invalidArgument('method', method);

  return function (services = missingArgument('services')) {

    if (!(typeof services === 'object' && services !== null && !Array.isArray(services))) invalidArgument('services', services);

    let sv = cache.get(services);
    if (!sv)
      cache.set(services, sv = new WeakMap()); // создаем новый кеш объект для данного объекта services
    else if (sv.has(method)) {
      const value = sv.get(method);
      if (typeof value === 'object' && value !== null && '__thrown' in value) throw value.__thrown;
      return value;
    }

    try {
      const res = method(services);
      sv.set(method, res); // сохраняем значение в кеше и возвращаем как результат
      return res;
    } catch (error) {
      const value = Object.create(null);
      value.__thrown = error;
      sv.set(method, value); // сохраняем ошибку в кеше и возвращаем как результат
      throw error;
    }
  }
};
