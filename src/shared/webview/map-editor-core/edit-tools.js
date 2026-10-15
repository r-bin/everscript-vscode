// Ownership: the editor's tool strip — which tools an adapter offers, which is active, the undo /
// redo buttons — as markup. Game-neutral; the adapter owns the tools and what they do. Needs
// view-chips.js (mapViewChipHtml). Plain browser script: defines globals.
//
// A tool is `{ id, label, title, key }`; `key` is the one-letter shortcut shown in the title.
// Clicks carry `data-edit-tool="<id>"` or `data-edit-act="undo|redo"`; the page binds them.

function editToolsHtml(tools, active, history) {
  var parts = tools.map(function (t) {
    return mapViewChipHtml({ label: t.label, on: t.id === active, attrs: { 'edit-tool': t.id },
      title: t.title + (t.key ? ' (' + t.key.toUpperCase() + ')' : '') });
  });
  var chips = mapViewSegHtml(parts);
  var undo = '<button class="rdf" data-edit-act="undo" title="Undo (Ctrl+Z)"' + (history.canUndo() ? '' : ' disabled') + '>Undo</button>';
  var redo = '<button class="rdf" data-edit-act="redo" title="Redo (Ctrl+Shift+Z)"' + (history.canRedo() ? '' : ' disabled') + '>Redo</button>';
  return chips + '<span class="ed-history">' + undo + redo + '</span>';
}

/** The tool a key selects, or null (`tools` as above; ignores keys with a modifier). */
function editToolForKey(tools, ev) {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return null;
  var k = String(ev.key || '').toLowerCase();
  for (var i = 0; i < tools.length; i++) if (tools[i].key && tools[i].key === k) return tools[i].id;
  return null;
}

/** True for the undo / redo shortcuts: 'undo', 'redo' or null. */
function editHistoryForKey(ev) {
  if (!(ev.ctrlKey || ev.metaKey) || String(ev.key).toLowerCase() !== 'z') return null;
  return ev.shiftKey ? 'redo' : 'undo';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { editToolForKey: editToolForKey, editHistoryForKey: editHistoryForKey };
