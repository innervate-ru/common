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
                  val?.forEach((row, i) => {
                    const newRow = processLevel(context, row, isOut);
                    if (newRow) {
                      (newVal || (newVal = val.slice()))[i] = newRow;
                    }
                  });
                  return newVal;
                }
            }
            continue;
          }
        }
        if (fieldDesc.udtype) {
          if (fieldDesc.udtype.indexOf('bcryptPassword')) {
            (res || (res = {}))[fieldDesc.name] = function (result, context, val, isOut) {
              if (!isOut && val) {
                return bcrypt.hash(val, BCRYPT_ROUNDS);
              }
              return REMOVE_FIELD;
            }
          }
          else if (fieldDesc.udtype.indexOf('fileToken')) {
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
                  const req = requestByContext(context);
                  try {
                    return auth._parseToken({context, token: val, isExpiredOk: false});
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
              for (const fieldName in val) {
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
