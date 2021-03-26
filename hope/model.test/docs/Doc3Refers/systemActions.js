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
      const {context, result, sqlWhere, sqlParams, sqlFilter, sqlOrder, filter, order, docDesc, model} = args;

      if (filter.hasOwnProperty('id')) {
        sqlParams.push(filter.id);
        sqlWhere.push(`id = $${sqlParams.length}`);
      }
    },
  };
});
