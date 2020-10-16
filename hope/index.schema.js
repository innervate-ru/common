import {VType, validateThisServiceSettings, validate} from '../validation/index';

import {isResult} from '../../../../lib/hope/lib/utils/_err'

export const ctor_settings = validateThisServiceSettings({
  model: {type: VType.Object(), required: true},
  postgres:  {type: VType.Object(), required: true},
  _final: true,
});

const commonFields = {
  context: {type: VType.String(), required: true},
  result: {type: VType.Object(), validate: r => isResult(r) ? true : 'not Result object'},
  http: {type: VType.Boolean()},
  connection: {type: VType.Object(), validate: r => typeof r.exec === 'function' ? true : 'not connection object'},
};

export const update_args = validate.method.this(undefined, {
  ...commonFields,
  type: {type: VType.String().notEmpty(), required: true},
  docId: {type: VType.String()},
  update: {type: VType.Object(), validate: v => !v.hasOwnProperty('id') || typeof(v.id) === 'string' || `invalid 'id'`},
  action: {type: VType.String().notEmpty()},
  actionArgs: {type: VType.Object()},
  _final: true,
});

export const get_args = validate.method.this(undefined, {
  ...commonFields,
  http: {type: VType.Boolean()},
  type: {type: VType.String().notEmpty()},
  docId: {type: VType.String().notEmpty(), required: true},
  _final: true,
});

export const applyUserRights_args = validate.method.this(undefined, {
  ...commonFields,
  doc: {type: VType.Object(), required: true, validate: v => typeof v._type === 'string' || `missing '_type'`},
  _final: true,
});

export const list_args = validate.method.this(undefined, {
  ...commonFields,
  http: {type: VType.Boolean()},
  type: {type: VType.String().notEmpty(), required: true},
  paging:  {type: VType.Boolean()},
  pageNo: {type: VType.Int().positive()},
  last: {type: VType.Boolean()},
  pageSize: {type: VType.Int().positive()},
  pageExtra:  {type: VType.Int().zero().positive()},
  offset:  {type: VType.Int().zero().positive()},
  limit:  {type: VType.Int().positive()},
  filter: {type: VType.Object()},
  order: {type: VType.Object()},
  // TODO:
  _final: true,
});

export const httpFix_args = validate.method.this(undefined, {
  context: {type: VType.String(), required: true},
  result: {type: VType.Object(), validate: r => isResult(r) ? true : 'not Result object'},
  fields: {type: VType.Object(), required: true},
  isOut: {type: VType.Boolean(), required: true},
  fieldsDesc: {type: VType.Object(), required: true},
  _final: true,
});
