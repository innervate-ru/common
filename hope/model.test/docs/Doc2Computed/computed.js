import oncePerServices from "../../../../services/oncePerServices";

export default oncePerServices(function (services) {

  return {

    /**
     * Название функции должно соотвествовать название поля в fields.js  Для вложенных полей надо использовать полное имя поля.  Например, 'address.distance'.
     *
     * @param context - nanoid контекст операции
     * @param result - объект result
     * @param doc - документ к которому принадлежит поле
     * @param docLevel - вложенный уровень документа.  Если поле на верхнем уровне, то doc === docLevel, если нет то запись в subtable или объект structure
     * @param env - общий объект между функциями считающими сomputed поля.  Позволяет использовать общий запрос для заполнения нескольких computed полей
     * @returns {any} Значение должно соответствовать типу поля
     */
    title({context, result, doc, docLevel, env}) {
      return 'some title';
    },

    "sum"({context, result, doc, docLevel, env}) {
      return doc.f1 + doc.f2;
    },

    "struct.v"({context, result, doc, docLevel, env}) {
      return docLevel.n;
    },

    "subtable.y"({context, result, doc, docLevel, env}) {
      return docLevel.x;
    },
  }
});
