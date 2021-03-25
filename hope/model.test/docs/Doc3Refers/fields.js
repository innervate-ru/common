export default {
  title: {type: 'string(20)'},
  doc: {refers: '#all'},
  struct: {
    fields: {
      n: {type: 'int'},
      v: {refers: 'doc.DictA'},
    },
  },
  subtable: {
    type: 'subtable',
    fields: {
      x: {type: 'int'},
      y: {refers: 'doc.DictB'},
    },
  },
}
