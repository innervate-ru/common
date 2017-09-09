export * from './validateObject' // фабрики для создание валидаторов, методы формтируюшие стандартные ошибки валидации
export const typesExport = require('./types'); // медоты для добавления новых типов и сабвалидаторов
export const VType = typesExport.VType; // точка для работы с типами
require('./typesBuiltIn').default(typesExport); // добавление стандартные типов и сабвалидаторов
