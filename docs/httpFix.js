import {missingService, oncePerServices} from '../services'
import requestByContext from '../context/requestByContext'
import bcrypt from 'bcrypt'
import {BCRYPT_ROUNDS} from '../auth/const'

const schema = require('./index.schema');

const REMOVE_FIELD = Object.create(null);

export default oncePerServices(function (services) {

    const {
      auth = missingService('auth'),
    } = services;

    function buildLevel(level) {

      let res;

      for (const fieldDesc in level.$$list) {
        switch (fieldDesc.type) {
          case 'structure': {
            const processLevel = buildLevel(fieldDesc.fields);
            if (processLevel) {
              (res || (res = {}))[fieldDesc.name] = processLevel;
            }
            continue;
          }
          case 'subtable': {
            const processLevel = buildLevel(fieldDesc.fields);
            if (processLevel) {
              (res || (res = {}))[fieldDesc.name] =
                function (result, context, val, isOut) {
                  let newVal;
                  if (val) {
                    let i;
                    result.context(
                      function (path) {
                        return path.index(i)(path);
                      },
                      function () {
                        for (i = 0; i < val.length; i++) {
                          const newRow = processLevel(result, context, row, isOut);
                          if (newRow) {
                            (newVal || (newVal = val.slice()))[i] = newRow;
                          }
                        }
                      });
                  }
                  return newVal;
                }
            }
            continue;
          }
        }
        if (fieldDesc.udType) {
          if (~fieldDesc.udType.indexOf('bcryptPassword')) {
            (res || (res = {}))[fieldDesc.name] = function (result, context, val, isOut) {
              if (!isOut && val) {
                return bcrypt.hash(val, BCRYPT_ROUNDS);
              }
              return REMOVE_FIELD;
            }
          }
          else if (~fieldDesc.udType.indexOf('fileToken')) {
            (res || (res = {}))[fieldDesc.name] = function (result, context, val, isOut) {
              if (isOut) {
                if (val) {
                  const req = requestByContext(context);
                  const newToken = {};
                  if (req.user) {
                    newToken.userId = req.user.id;
                  }
                  Object.assign(newToken, val);
                  return auth._signToken({context, token: newToken, notExpired:: true});
                }
              } else {
                if (val) {
                  try {
                    const token = auth._parseToken({context, token: val, isExpiredOk: false});
                    if (token.userId) {
                      const req = requestByContext(context);
                      if (!req.user) {
                        result.error('doc.assignedToUserTokenSentToNotAuthorizedUser');
                        return;
                      }
                      if (req.user.id !== token.userId) {
                        result.error('doc.assignedToUserTokenSentToAnotherUser');
                        return;
                      }
                    }
                    return token;
                  } catch (err) {
                    result.error(err.message);
                  }
                }
              }
            }
          }
        }
        if (res) {
          return function (result, context, val, isOut) {
            let newVal;
            if (val) {
              let fieldName;
              result.context(
                function (path) {
                  return path.prop(fieldName)(path);
                },
                function () {
                  for (fieldName in val) {
                    if (res[fieldName]) {
                      const r = res[fieldName](context, val[fieldName], isOut);
                      if (r !== undefined) {
                        if (!newVal) {
                          newVal = {...val};
                        }
                        if (r === REMOVE_FIELD) {
                          delete newVal[fieldName];
                        } else {
                          newVal[fieldName] = r;
                        }
                      }
                    }
                  }
                });
            }
            return newVal;
          }
        }
      }

      return res;
    }

    const processor = new Map;

    return async function httpFix(args) {

      schema.httpFix_args(args);

      const {context, resulr, fields, isOut, fieldsDesc} = args;

      let proc = processor.get(fieldsDesc);

      if (!proc) {
        proc = buildLevel(fieldsDesc);
        if (!proc) {
          proc = function (result, context, val, isOut) {
            return val;
          };
        }
        processor.set(fieldsDesc, proc);
      }

      const r = proc(result, context, fields, isOut);
      if (!result.isError) {
        return r;
      }
    };
  }
);
