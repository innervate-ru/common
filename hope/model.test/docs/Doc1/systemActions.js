import oncePerServices from "../../../../services/oncePerServices";

const schema = require('../../../actions.schema');

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
  };
});
