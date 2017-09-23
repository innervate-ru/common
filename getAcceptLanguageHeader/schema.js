import {
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql';

const selectLocale = {
  name: 'locale_prefered_locales',

  description: `Для списка поддерживаемых клиентом локализаций, возвращает наиболее подходящую.`,

  args: {
    supportedLocales: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
      description: `
        Список locale, который поддреживает клиент`
    },
  },

  type: new GraphQLObjectType({
    name: 'locale_prefered_locales__output',
    fields: {
      locale: {type: new GraphQLNonNull(GraphQLString)},
    }
  }),
};

export default function (queries, mutations) {
  queries.locale = {
    name: `Locale`,
    description: `Запросы (queries) сервиса 'Locale'`,
    type: new GraphQLObjectType({
      name: `LocaleQueries`,
      fields: {
        selectLocale: selectLocale,
      }
    }),
  };
}
