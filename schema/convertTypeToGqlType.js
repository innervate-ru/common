import {missingArgument} from '../validation'

/**
 * Стандартное приобразование типов в схеме в graphQL типы.
 *
 * @param methodName - префикс для имен типов связанных с методом.
 * @param method - описание метода (схема).
 * @param type - тип в текстовом виде, как он пишется в схеме
 */
export function convertTypeToGqlType({
  methodName = missingArgument('methodName'),
  method = missingArgument('method'),
  type,
}) {
  switch (type) {
    case 'string':
      return 'String';
    case 'xml':
      return 'String';
    case 'int':
      return 'Int';
    case 'bit':
      return 'Boolean';
    case 'float':
      return 'Float';
    case 'bool':
      return 'Boolean';
    case 'date':
      return 'String'; // TODO: Поправить когда будет кастом тип Date
    default:

      console.error(`Method '${method.name}': ${param ? `Parameter '${param.name}'` : `Field ${field.name}`}: Unknown type: '${type}'`);
      throw new InvalidSchemaException();
  }
}
