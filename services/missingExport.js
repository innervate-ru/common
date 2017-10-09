import {missingArgument} from '../validation/arguments'

class MissingExport extends Error {
  constructor(exportName) {
    super(`Missing export '${exportName}'`);
  }
}
MissingExport.prototype.name = 'MissingExport';

export default function missingService(exportName = missingArgument('exportName')) {
  throw new MissingExport(exportName);
}
