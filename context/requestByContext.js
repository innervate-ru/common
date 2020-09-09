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

export function addRequestMiddleware(getContext) {
  return function(req, resp, next) {
    addRequest(req.context?.reqId);
    next();
  }
}

export function removeRequestMiddleware(getContext) {
  return function(req, resp, next) {
    removeRequest(req.context?.reqId);
    next();
  }
}
