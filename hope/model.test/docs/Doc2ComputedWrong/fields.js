export default {
  title: {type: 'text', tags: 'computed'},
  f1: {type: 'int', null: true},
  f2: {type: 'int'},
  sum: {type: 'int', tags: 'computed'},
  struct: {
    fields: {
      n: {type: 'int'},
      v: {type: 'int', tags: 'computed'},
    },
  },
  subtable: {
    type: 'subtable',
    fields: {
      x: {type: 'int'},
      y: {type: 'int', tags: 'computed'},
    },
  },
}
