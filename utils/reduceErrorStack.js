import StackUtils from 'stack-utils'

const commonInternals = /src\/common\/(validation|services\/(missingService|oncePerServices))/;
const babelAndBluebird = /node_modules\/(regenerator-runtime|bluebird)\//;
const babelCli = /node_modules\/babel-cli/;

const ignoreStackLines = StackUtils.nodeInternals();
ignoreStackLines.push(babelAndBluebird);
ignoreStackLines.push(commonInternals);
ignoreStackLines.push(babelCli);

const stackUtils = new StackUtils({internals: ignoreStackLines});

/**
 * Уменьшает размер поля stack у обьекта Error, за счет удаления информации, которая не помогает - вызовы кода в babel, код валидаторов ...
 * Так же в качестве заголовка подставляет поле message, так как оно могло быть изменено методом ./addPrefixToErrorMessage.
 *
 * Внимание: Этот метод не изменяется объект error, так как может быть использован в момент передачи данных, при этом не должен портить полную информацию в Error.
 */
export default function reduceErrorStack(error, message) {
  const stack = error.stack;
  const title = stack.split('\n')[0];
  const lines = stackUtils
    .clean(stack)
    .split('\n')
    .map(x => `    ${x}`)
    .join('\n');
  return `${message || error.message}\n${lines}`
}
