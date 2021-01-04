import oncePerServices from "../../../../../services/oncePerServices";

export const model = {
  static: true,
  arguments: {
    email: {type: 'string(360)'},
    password: {type: 'string(60)'},
  },
  result: {
    token: {type: 'text'},
  }
};

export default oncePerServices(function (services) {

  const {
    // docs = missingService('docs'),
    // interaction = missingService('interaction'),
  } = services;

  return function login({context, result, args, docDesc, actionDesc, model}) {
    return {
      result: {
        token: '321',
      }
    };
  };
});
