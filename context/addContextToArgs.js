import {invalidArgument} from '../validation'

import shortid from 'shortid'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Если в args нет поля context, добавляет его, с уникальным значением shortid, и возвращает объект с новыми параметрами.
 */
export default function addContextToArgs(args) {

  if (args === undefined || args === null) {
    const newArgs = Object.create(null);
    newArgs.context = shortid();
    return newArgs;
  }

  if (!(typeof args === 'object' && !Array.isArray(args))) invalidArgument('args', args);


  if (hasOwnProperty.call(args, 'context')) return args;

  const newArgs = Object.assign(Object.create(null), args);
  newArgs.context = shortid();
  return newArgs;
};
