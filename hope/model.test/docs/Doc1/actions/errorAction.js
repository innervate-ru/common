import oncePerServices from "../../../../../services/oncePerServices";

export const model = {
  static: true,
};

export default oncePerServices(function (services) {

  return function submit({context, result, doc, args, docDesc, actionDesc, model}) {

    result.error('someError');
  };
});
