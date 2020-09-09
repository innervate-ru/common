const map = Object.create(null);

export function addRequest(context, request) {
  map[context] = request;
}

export function removeRequest(context) {
  delete map[context];
}

export default function get(context) {
  return map[context];
}
