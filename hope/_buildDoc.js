const cache = new WeakMap();

function buildComputedLevel(processComputed, computedMask, fieldsLevel) {

  fieldsLevel.$$list.forEach((fieldDesc) => {

    const fieldName = fieldDesc.name;
    const computed = fieldDesc.$$computed;
    const index = fieldDesc.$$index;

    if (computed) {

      processComputed.push(function (res, mask, args) {

        if (mask.get(index)) {

          const val = computed({...args, path: `${args.path ? `${args.path }.` : ''}${fieldName}`});

          if (val !== undefined) {

            (res || (res = [])).push(Promise.resolve(val).then((val) => {
              // TODO: Валидировать созсащаемое значение
              args.docLevel[fieldName] = val;
            }));

            return res;
          }
        }
      });
    } else if (~['structure', 'subtable'].indexOf(fieldDesc.type)) {

      const fieldComputedMask = computedMask.and(fieldDesc.$$mask).lock();
      if (fieldComputedMask.isEmpty()) return;

      const processSubfieldsComputed = [];

      buildComputedLevel(processSubfieldsComputed, computedMask, fieldDesc.fields);

      function processStruct(res, mask, args) {

        processSubfieldsComputed.forEach((processSubfield) => {

          res = processSubfield(res, mask, args);
        });

        return res;
      }

      if (fieldDesc.type === 'structure') {

        processComputed.push(function (res, mask, args) {

          if (!mask.and(fieldComputedMask).isEmpty()) {

            res = processStruct(res, mask, {...args, docLevel: args.docLevel[fieldName], path: `${args.path ? `${args.path}.` : ''}${fieldName}`});
          }

          return res;
        });
      } else { // subtable

        processComputed.push(function (res, mask, args) {

          if (!mask.and(fieldComputedMask).isEmpty()) {

            args.docLevel[fieldName].forEach((level, i) => {

              // TODO: Add row path
              res = processStruct(res, mask, {...args, docLevel: level, path: `${args.path ? `${args.path}.` : ''}${fieldName}[${i}]`});
            });
          }

          return res;
        });
      }
    }
  });
}

export default async function build(context, result, docDesc, row, mask, refersMask) {
    const {options, ...rest} = row;
  const fullDoc = options ? docDesc.fields.$$set(options, rest) : rest;

  const computedMask = mask.and('#computed', {strict: false}).lock();

  if (!computedMask.isEmpty()) {

    let processComputed = cache.get(docDesc);

    if (!processComputed) {

      processComputed = [];

      buildComputedLevel(processComputed, docDesc.fields.$$calc('#computed'), docDesc.fields);

      cache.set(docDesc, processComputed);
    }

    let res = undefined;

    processComputed.forEach((f) => {

      res = f(res, computedMask, {
        context,
        result,
        doc: fullDoc,
        docLevel: fullDoc,
        env: {},
      });
    });

    if (res) await Promise.all(res);
  }

  const access = docDesc.$$access(fullDoc);
  const res = docDesc.fields.$$get(fullDoc, access.view.or(access.update));

  res._type = docDesc.name;
  return res;
}
