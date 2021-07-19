import {invalidArgument, tooManyArguments, notEnoughArguments, isObject, isBitArray} from '../../validation/arguments'

/**
 * Only for testing purposes!
 */
export default function (...args) {

  if (arguments.length < 1) notEnoughArguments();
  if (arguments.length > 1) tooManyArguments();

  const {doc, user, view, update, actions, relations, fullFields, fullActions, ...rest} = args[0];

  if (!(isObject(this) && this.hasOwnProperty('fields') && this.hasOwnProperty('actions'))) invalidArgument('this', this);

  if (!(user === null || (isObject(user) && user.hasOwnProperty('id')))) invalidArgument('user', user);
  if (!(doc === null || isObject(doc))) invalidArgument('doc', doc);

  if (!(isBitArray(view) && view._collection === this.fields)) invalidArgument('view', view);
  if (!(isBitArray(update) && update._collection === this.fields)) invalidArgument('update', update);
  if (!(isBitArray(relations) && relations._collection === this.fields)) invalidArgument('relations', relations);
  if (!(isBitArray(fullFields) && fullFields._collection === this.fields)) invalidArgument('fullFields', fullFields);

  if (!(isBitArray(actions) && actions._collection === this.actions)) invalidArgument('actions', actions);
  if (!(isBitArray(fullActions) && fullActions._collection === this.actions)) invalidArgument('fullActions', fullActions);

  for (const k in rest) {
    invalidArgument(k, rest[k]);
    break;
  }
}

