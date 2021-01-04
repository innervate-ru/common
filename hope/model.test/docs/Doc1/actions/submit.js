import oncePerServices from "../../../../../services/oncePerServices";

export const model = {
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
};

export default oncePerServices(function (services) {

  const {
    // docs = missingService('docs'),
    // interaction = missingService('interaction'),
  } = services;


  return function submit({context, result, doc, args, docDesc, actionDesc, model}) {

    // doc = docs.get({type, id})

    // docs.update({type, doc, action: 'submitted'});
    // doc = docs.update({type, doc});

    // TODO:
    return {
      update: {
        f1: 'from action',
        st: args.z,
      },
    }
  };
});
