// Ownership: the editor's keys — which tool a letter selects, and the undo / redo shortcuts. Game-neutral: an
// adapter lists its tools as `{ id, key }`. The tool strip itself is the shell's pill
// (src/core/map-editor/shell/frame.js shellPillHtml). Plain browser script: defines globals (and
// `module.exports` under Node, for the unit test).

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
