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

      for (const fieldDesc of level.$$list) {
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
                function (context, result, val, isOut, promises) {
                  let newVal;
                  if (val) {
                    let i;
                    result.context(
                      function (path) {
                        return path.index(i)(path);
                      },
                      function () {
                        for (i = 0; i < val.length; i++) {
                          const newRow = processLevel(context, result, row, isOut, promises);
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
            (res || (res = {}))[fieldDesc.name] = function (context, result, val, isOut, promises) {
              if (!isOut && val) {
                const promise = bcrypt.hash(val, BCRYPT_ROUNDS);
                promises.push(promise);
                return promise;
              }
              return REMOVE_FIELD;
            }
          }

          else if (~fieldDesc.udType.indexOf('fileToken')) {
            (res || (res = {}))[fieldDesc.name] = function (context, result, val, isOut, promises) {
              if (isOut) {
                if (val) {
                  const req = requestByContext(context);
                  const newToken = {};
                  if (req?.user) {
                    newToken.userId = req.user.id;
                  }
                  Object.assign(newToken, val);
                  return auth._signToken({context, token: newToken, notExpired: true});
                }
              } else {
                if (val) {
                  try {
                    const token = auth._parseToken({context, token: val, isExpiredOk: false});
                    if (token.userId) {
                      const req = requestByContext(context);
                      if (!req?.user) {
                        result.error('doc.assignedToUserTokenSentToNotAuthorizedUser');
                        return;
                      }
                      if (req.user.id !== token.userId) {
                        result.error('doc.assignedToUserTokenSentToAnotherUser');
                        return;
                      }
                      delete token.userId;
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
      }

      if (res) {
        return function (context, result, val, isOut, promises) {
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
                    const r = res[fieldName](context, result, val[fieldName], isOut, promises);
                    if (r !== undefined) {
                      if (!newVal) {
                        newVal = {...val};
                      }
                      if (r === REMOVE_FIELD) {
                        delete newVal[fieldName];
                      } else {
                        if (typeof r === 'object' && r !== null && 'then' in r) {
                          (function (fieldName) {
                            promises.push(r.then((data) => {
                              newVal[fieldName] = data;
                            }));
                          })(fieldName);
                        } else {
                          newVal[fieldName] = r;
                        }
                      }
                    }
                  }
                }
              });
          }
          return newVal;
        }
      }

      return res;
    }

    const processor = new Map;

    return async function httpFix(args) {

      schema.httpFix_args(args);

      const {context, result, fields, isOut, fieldsDesc} = args;

      let proc = processor.get(fieldsDesc);

      if (!proc) {
        proc = buildLevel(fieldsDesc);
        if (proc) {
          proc =
            (function (proc) {
              return function (context, result, val, isOut, promises) {
                const newVal = proc(context, result, val, isOut, promises);
                return newVal || val;
              };
            })(proc);
        } else {
          proc = function (context, result, val, isOut, promises) {
            return val;
          };
        }
        processor.set(fieldsDesc, proc);
      }

      const promises = [];
      const r = proc(context, result, fields, isOut, promises);
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      if (!result.isError) {
        return r;
      }
    };
  }
);
