import schema from './schema'

/**
 * Заполняет graphQL данными для методов сервиса, на освнове:
 * - глобальных правил, прописанных в классе ./CyberlinesSchemaToGQL
 * - описания методов сервиса
 * - gql... аттрибутов в описании методов сервиса
 * - модификации описания методов в классах экспортируемых как gqlExtClass из описания методов
 *
 * Если параметр rootResolvers равен null, то метод заполняет только схему.  И не заполняет resolver'ы.
 */
export default function initGraphQL({
  types = throwIfMissing('types'),
  queries = throwIfMissing('queries'),
  mutations = throwIfMissing('mutations'),
  rootResolvers = throwIfMissing('rootResolvers'),
}) {

  let queriesBefore = Object.keys(queries).length;
  let mutationsBefore = Object.keys(mutations).length;

  schema(queries, mutations);

  if (rootResolvers) require('./resolvers').default(rootResolvers);

  console.info(`GraphQL: Service 'locale': ${Object.keys(queries).length - queriesBefore} queries; ${Object.keys(mutations).length - mutationsBefore} mutations`);
}
