export default function ({doc, view, update, required, actions}) {

  if (!doc) return;

  view.set('b, c, c.e, f, f.h');
  update.set('a, b, c, c.d, f, f.h');
  actions.set('do2');
}
