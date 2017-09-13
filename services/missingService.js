export default function missingService(name) {
  throw new Error(`Missing service '${name}'`);
}
