import {
  validateAndCopyOptionsFactory,
  VType,
} from '../validation'

export const config = validateAndCopyOptionsFactory({
  stop: {type: VType.Boolean()},
  description: {type: VType.String()},
  uri: {type: VType.String().notEmpty(), required: true},
  login: {type: VType.String().notEmpty(), required: false},
  password: {type: VType.String().notEmpty(), required: false},
  httpLogin: {type: VType.String().notEmpty(), required: false},
  httpPassword: {type: VType.String().notEmpty(), required: false},
  soapOptions: {type: VType.Object(), required: false}, // Опция для прокидывания https://www.npmjs.com/package/soap#specifying-the-exact-namespace-definition-of-the-root-element
});
