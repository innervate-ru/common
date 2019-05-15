import {makeExecutableSchema} from "graphql-tools";
import {oncePerServices, missingService} from "../../common/services";
import {missingArgument} from "../../common/utils/arguments";
import {SchemaBuilder} from "../../common/graphql";

export default oncePerServices(function (services = missingArgument("services")) {
  const {
    bus = missingService("bus")
  } = services;

  return async () => {
    const typeDefs = [];
    const resolvers = Object.create(null);

    require("../../common/graphql/addCustomTypes").default(typeDefs, resolvers);

    await (new SchemaBuilder({
      monitoring: require("./graphql").default(services),
    }).build({bus, typeDefs, resolvers}));

    return makeExecutableSchema({
      typeDefs,
      resolvers
    });
  };
});
