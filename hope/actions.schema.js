import {validate, VType} from "../validation/index";

import {isResult} from '../../../../lib/hope/lib/utils/_err'

export const list_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  result: {type: VType.Object(), validate: r => isResult(r) ? true : 'not Result object'},
  sqlWhere: {type: VType.Array(), required: true},
  sqlOrder: {type: VType.Array(), required: true},
  sqlParams: {type: VType.Array(), required: true},
  filter: {type: VType.Object(), required: true},
  order: {type: VType.Object(), required: true},
  docDesc: {type: VType.Object(), required: true},
  model: {type: VType.Object(), required: true},
  setCatchError: {type: VType.Function(), required: true},
  _final: true,
});

export const update_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  result: {type: VType.Object(), validate: r => isResult(r) ? true : 'not Result object'},
  doc: {type: VType.Object(), required: true},
  prevDoc: {type: VType.Object()},
  actionDesc: {type: VType.Object(), required: true},
  docDesc: {type: VType.Object(), required: true},
  model: {type: VType.Object(), required: true},
  _final: true,
});

export const retrieve_args = update_args;
export const create_args = update_args;
export const delete_args = update_args;
export const restore_args = update_args;




