export * from './validateObject' // фабрики для создание валидаторов, методы формтируюшие стандартные ошибки валидации
export const typesExport = require('./types'); // методы для добавления новых типов и сабвалидаторов
export const VType = typesExport.VType; // точка для работы с типами
export * from './arguments'
require('./typesBuiltIn').default(typesExport); // добавление стандартные типов и сабвалидаторов

