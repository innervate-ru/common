/**
 * All rights that user in its roles may ever get by rights(...).  If result of rights(...) will exceed result of
 * fullRights(...) for any given user, an error will be raised.
 */
export function fullRights({user, fullFields, fullActions, docDesc}) {

}

/**
 * Relations that are used by rights(...) for given state of the doc and for given user roles.
 */
// Note: Adding relations fields, make sure those fields are available in result of $$access(...) for given state
// of the doc.  Otherwise an error will be raised.
export function relations({doc, user, relations, docDesc}) {

}

/**
 * User rights computed based on the doc state and the user roles.
 */
// Note: Adding fields/actions (tags) in view, update or actions masks, make sure they are accessible in fullRights(...)
export function rights({doc, user, view, update, actions, docDesc}) {

}
