import oncePerServices from "../services/oncePerServices";

export default oncePerServices(function (services) {

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

        buildComputedLevel.call(this, processSubfieldsComputed, computedMask, fieldDesc.fields);

        function processStruct(res, mask, args) {

          processSubfieldsComputed.forEach((processSubfield) => {

            res = processSubfield(res, mask, args);
          });

          return res;
        }

        if (fieldDesc.type === 'structure') {

          processComputed.push(function (res, mask, args) {

            if (!mask.and(fieldComputedMask).isEmpty()) {

              res = processStruct(res, mask, {
                ...args,
                docLevel: args.docLevel[fieldName],
                path: `${args.path ? `${args.path}.` : ''}${fieldName}`
              });
            }

            return res;
          });
        } else { // subtable

          processComputed.push(function (res, mask, args) {

            if (!mask.and(fieldComputedMask).isEmpty()) {

              args.docLevel[fieldName].forEach((level, i) => {

                res = processStruct(res, mask, {
                  ...args,
                  docLevel: level,
                  path: `${args.path ? `${args.path}.` : ''}${fieldName}[${i}]`
                });
              });
            }

            return res;
          });
        }
      } else if (fieldDesc.type === 'refers') {

        processComputed.push(function (res, mask, args) {

          if (mask.get(index)) {

            if (args.docLevel[fieldName]) {

              (res || (res = [])).push(
                (async () => {

                  args.docLevel[fieldName] = await this.get({

                    context: args.context,

                    result: args.result,

                    docId: args.docLevel[fieldName],

                    mask: args.refersMask,
                  });
                })());
            }
          }

          return res;
        });
      }
    });
  }

  return async function build(context, result, docDesc, row, mask, refersMask) {
    const {options, ...rest} = row;
    const fullDoc = options ? docDesc.fields.$$set(options, rest) : rest;

    mask = mask.add('id').remove('options', {strict: false}).lock();

    console.info(124, refersMask, mask.list.map(v => v.name));

    let processComputed = cache.get(docDesc);

    if (!processComputed) {

      processComputed = [];

      buildComputedLevel.call(this, processComputed, docDesc.fields.$$calc('#computed', {strict: false}).lock(), docDesc.fields);

      cache.set(docDesc, processComputed);
    }

    let promises = undefined;

    processComputed.forEach((f) => {

      promises = f.call(this, promises, mask, {
        context,
        result,
        doc: fullDoc,
        docLevel: fullDoc,
        refersMask,
        env: {},
      });
    });

    if (promises) await Promise.all(promises);

    const access = docDesc.$$access(fullDoc);
    // const res = docDesc.fields.$$get(fullDoc, access.view.or(access.update), {mask: mask, /*keepRefers: true*/});
    const res = docDesc.fields.$$get(fullDoc, mask);

    res._type = docDesc.name;
    return res;
  };

})
