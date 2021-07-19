export default {
  a: {type: 'string(20)'},
  b: {type: 'int'},
  c: {
    type: 'struct',
    fields: {
      d: {type: 'int'},
      e: {refers: 'doc.DictA'},
    },
  },
  f: {
    type: 'subtable',
    fields: {
      g: {type: 'int'},
      h: {type: 'double'},
    },
  },
}
