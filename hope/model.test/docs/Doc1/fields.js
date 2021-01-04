export default {
  f1: {type: 'string(20)', null: true},
  f2: {type: 'int'},
  st: {
    type: 'subtable',
    fields: {
      a: {type: 'int'},
      b: {type: 'string(20)', required: true},
    },
  },
  str: {
    fields: {
      c: {type: 'int'},
      d: {type: 'string(20)', required: true},
    }
  },
  password: {
    type: 'bcryptPassword',
  },
  file: {
    type: 'fileToken',
    null: true,
  },
}
