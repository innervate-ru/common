export default {
  title: {type: 'text', tags: 'computed'},
  f1: {type: 'string(20)', null: true},
  f2: {type: 'int'},
  struct: {
    fields: {
      a: {type: 'int'},
      b: {type: 'int'},
      c: {type: 'int'},
    },
    tags: 'computed',
  },
}
