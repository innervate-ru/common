import {invalidArgument} from '../validation'

import {nanoid} from 'nanoid'

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Если в args нет поля context, добавляет его, с уникальным значением nanoid, и возвращает объект с новыми параметрами.
 */
export default function addContextToArgs(args) {

  if (args === undefined || args === null) {
    const newArgs = Object.create(null);
    newArgs.context = nanoid();
    return newArgs;
  }

  if (!(typeof args === 'object' && !Array.isArray(args))) invalidArgument('args', args);

  if (typeof args.context === 'string') return args;

  const newArgs = Object.assign(Object.create(null), args);
  newArgs.context = nanoid();
  return newArgs;
};
