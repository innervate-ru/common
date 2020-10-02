import oncePerServices from "../../../../services/oncePerServices";
import missingService from "../../../../services/missingService";


const schema = require('../../../list.schema');

export default oncePerServices(function (services) {

  const {
    // docs = missingService('docs'),
    // interaction = missingService('interaction'),
  } = services;


  return {

    list(args) {
      schema.list_args(args);
      const {context, result, sqlWhere, sqlFilter, sqlOrder, filter, order, docDesc, model} = args;

      if (order.f2) {
        sqlOrder.push(`options->'f2'`);
      }
    },

    submit({context, result, doc, args, docDesc, actionDesc, model}) {

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
    },
  };
});
