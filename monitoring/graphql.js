import {oncePerServices} from "../services/index";
import graphqlBuilderSchema from "../graphql/LevelBuilder.schema"

const PREFIX = require('../graphql/typePrefix').default(__dirname);

export default oncePerServices(function (services) {
  return async (args) => {
    require("../graphql/LevelBuilder.schema").build_options(args);

    const {parentLevelBuilder, typeDefs, builderContext} = args;
    const monitoring = require("./index").default(services);

    typeDefs.push(`
      type ${PREFIX}Service {
        name: String,
        state: String!,
        stop: Boolean!,
        dependenciesReady: Boolean!,
        serviceError: String
      }
    `);

    typeDefs.push(`
      type ${PREFIX}ServiceResult {
        result: String!,
      }
    `);

    parentLevelBuilder.addQuery({
      name: "getServices",
      type: `[${PREFIX}Service]`,
      resolver: (obj, args, context) => monitoring.getServices({reqContext: context.request.context, context: context.request.context.reqId}),
    });

    parentLevelBuilder.addQuery({
      name: "getService",
      args: "name: String!",
      type: `${PREFIX}Service`,
      resolver: (obj, args, context) => monitoring.getService({...args, reqContext: context.request.context, context: context.request.context.reqId})
    });

    parentLevelBuilder.addMutation({
      name: "stopService",
      args: "name: String!",
      type: `${PREFIX}ServiceResult!`,
      resolver: (obj, args, context) => monitoring.stopService({...args, reqContext: context.request.context, context: context.request.context.reqId})
    });

    parentLevelBuilder.addMutation({
      name: "startService",
      args: "name: String!",
      type: `${PREFIX}ServiceResult!`,
      resolver: (obj, args, context) => monitoring.startService({...args, reqContext: context.request.context, context: context.request.context.reqId})
    });
  }
});
