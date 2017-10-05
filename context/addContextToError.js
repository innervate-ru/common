const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Добавляет в ошибку информацию о том, в каком контексте случилась ошибка - context.id.  Плюс в список context.stack
 * добавляется информация о контексте - в каком методе / http-вызове / graphql-запросе случилась ошибка, и какие
 * были при этом параметры.
 *
 * Возвращает true, если это корень контекста, что нужно чтобы внешний код знал что он должен отправить эту информацию в шину данных.
 */
export default function addContextToError(args, newArgs, error, details) {
  const context = newArgs.context;
  const newDetails = Object.assign(Object.create(null), details);
  if (args) {
    if (hasOwnProperty.call(args, 'context')) { // если аргументы были с контекстом, чтоб не дублировать много раз - удаляем контекст из сохраняемых аргументов
      const argsWOContext = Object.assign(Object.create(null), args);
      delete argsWOContext.context;
      newDetails.args = argsWOContext;
    } else {
      newDetails.args = args; // добавляем аргументы в детали
    }
  } else {
    delete newDetails.args; // если нет аргументов, проверяем что их не и в деталях
  }
  if (hasOwnProperty.call(error, 'context')) { // контекст уже есть - так что просто добавляем к нему
    if (error.context.id !== context) {
      error.context.stack.push(`Context being replaced to '${error.context.id}'`);
      error.context.id = context;
    }
    error.context.stack.push(newDetails);
  } else { // добавляем свойство context: {id, stack} в error
    const errorContext = error.context = Object.create(null);
    errorContext.id = context;
    errorContext.stack = [newDetails];
  }
  return args != newArgs; // true, значит был создан методом ./addContextToArgs новый вариант args, для того чтобы добавить поле context
}
