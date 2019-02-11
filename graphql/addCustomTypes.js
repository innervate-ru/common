import GraphQLJSON from 'graphql-type-json'
import {GraphQLDate, GraphQLTime, GraphQLDateTime} from 'graphql-iso-date'

export default function(typeDefs, resolvers) {

  typeDefs.push(`
scalar JSON
scalar Date
scalar DateTime
scalar Time`);

  resolvers.JSON = GraphQLJSON;
  resolvers.Time = GraphQLTime;
  resolvers.DateTime = GraphQLDateTime;
  resolvers.Date = GraphQLDate;
}
