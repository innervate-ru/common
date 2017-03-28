import * as _graphql from 'graphql';

/**
 * Функция взята из graphql-relay, и убран параметр mutateAndGetPayload.  Так как в проекты мы резолверы
 * делаем в коде отдельном от кода схемы.
 *
 * @param config
 * @returns {{type: (GraphQLObjectType|*), description: *, args: {input: {type: (GraphQLNonNull|*)}}}}
 */
export default function mutationWithClientMutationId(config) {
  var name = config.name,
    description = config.description,
    inputFields = config.inputFields,
    outputFields = config.outputFields;

  var augmentedInputFields = function augmentedInputFields() {
    return Object.assign({}, resolveMaybeThunk(inputFields), {
      clientMutationId: {
        type: _graphql.GraphQLString
      }
    });
  };
  var augmentedOutputFields = function augmentedOutputFields() {
    return Object.assign({}, resolveMaybeThunk(outputFields), {
      clientMutationId: {
        type: _graphql.GraphQLString
      }
    });
  };

  var outputType = new _graphql.GraphQLObjectType({
    name: name + 'Payload',
    fields: augmentedOutputFields
  });

  var inputType = new _graphql.GraphQLInputObjectType({
    name: name + 'Input',
    fields: augmentedInputFields
  });

  return {
    type: outputType,
    description: description,
    args: {
      input: { type: new _graphql.GraphQLNonNull(inputType) }
    },
  };
}

function resolveMaybeThunk(thingOrThunk) {
  return typeof thingOrThunk === 'function' ? thingOrThunk() : thingOrThunk;
}
