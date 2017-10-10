import {VType, validate} from '../validation'

const hasOwnProperty = Object.prototype.hasOwnProperty;

export const build_args = validate.method.finished('args', {
  _extends: require('../graphql/LevelBuilder.schema').build_options,
  PREFIX: {required: true, type: VType.String()},
  serviceName: {required: true, type: VType.String().notEmpty()},
  method: {required: true, type: VType.Object(v => hasOwnProperty.call(v, 'gqlType' ? true : `not a stored procedure definition`))},
  connector: {required: true, type: VType.Object(v => hasOwnProperty.call(v, '_service') ? true : `not a service`)},
});
