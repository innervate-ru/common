export default function build(docDesc, row) {
  const {options, ...rest} = row;
  const fullDoc = options ? docDesc.fields.$$set(options, rest) : rest;
  const access = docDesc.$$access(fullDoc);
  const res = docDesc.fields.$$get(fullDoc, access.view.or(access.update));
  res._type = docDesc.name;
  return res;
}
