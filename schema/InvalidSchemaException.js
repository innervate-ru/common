export default class InvalidSchemaException extends Error {
  constructor() {
    super('Invalid schema.  See log for details.');
  }
}
