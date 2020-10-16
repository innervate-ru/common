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
    password: {
      type: 'bcryptPassword',
    },
    file: {
      type: 'fileToken',
      null: true,
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
    login: {
      static: true,
      arguments: {
        email: {type: 'string(360)'},
        password: {type: 'string(60)'},
      },
      result: {
        token: {type: 'text'},
      }
    }
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
