import checkRightsArgs from './_checkRightsArgs'

/**
 * All rights that user in its roles may ever get by rights(...).  If result of rights(...) will exceed result of
 * fullRights(...) for any given user, an error will be raised.
 */
export function fullRights(...args) {
  checkRightsArgs.apply(this, args);
  const {user, fullFields, fullActions, docDesc} = args;
  global.testRights?.fullRights?.apply(this, args);
}

/**
 * Relations that are used by rights(...) for given state of the doc and for given user roles.
 */
// Note: Adding relations fields, make sure those fields are available in result of $$access(...) for given state
// of the doc.  Otherwise an error will be raised.
export function relations(...args) {
  checkRightsArgs.apply(this, args);
  const {doc, user, relations, docDesc} = args;
  global.testRights?.relations?.apply(this, args);
}

/**
 * User rights computed based on the doc state and the user roles.
 */
// Note: Adding fields/actions (tags) in view, update or actions masks, make sure they are accessible in fullRights(...)
export function rights(...args) {
  checkRightsArgs.apply(this, args);
  const {doc, user, view, update, actions, docDesc} = args;
  global.testRights?.rights?.apply(this, args);
}
