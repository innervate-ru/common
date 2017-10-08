const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Заменяем список сервисов в dependsOn на список имен сервисов
 */
export default function fixDependsOn(ev) {
  if (hasOwnProperty.call(ev, 'dependsOn'))
    ev.dependsOn = ev.dependsOn.map(v => v._service.name);
}
