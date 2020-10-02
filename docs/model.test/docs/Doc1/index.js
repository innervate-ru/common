export default {
  fields: {
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
  },
  actions: {
    list: {
      arguments: {
        a: {type: 'int'},
        b: {type: 'string(20)', required: true},
      },
    },
    submit: {
      arguments: {
        x: {type: 'int'},
        y: {type: 'string(20)', null: true},
        z: {
          type: 'subtable', fields: {
            a: {type: 'int'},
            b: {type: 'string(20)', required: true},
          }
        },
      }
    },
    submitted: {},
  },
  states: {
    new: {
      transitions: {
        submit: 'submit',
      },
    },
    submit: {
      transitions: {
        submitted: 'submitted',
      },
    },
    submitted: {},
  }
}
