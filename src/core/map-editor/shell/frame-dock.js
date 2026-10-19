// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: mounting the editor shell's dock beside the canvas column (the DOM half of frame.ts; the markup
// builders are frame.ts). Plain browser script: globals.

/**
 * Put the dock beside the canvas column: the column moves into a row `.rg-edit-row`, the room's name
 * line heads it, a splitter and the dock (`#rg-dock > #rg-panels`) follow. Returns
 * {dock, panels, created}; `created` is false when it was already there.
 */
function shellDockMount(outer) {
  var dock = document.getElementById('rg-dock');
  if (dock) return { dock: dock, panels: document.getElementById('rg-panels'), created: false };
  var row = document.createElement('div');
  row.className = 'rg-edit-row';
  dock = document.createElement('div');
  dock.className = 'rg-dock';
  dock.id = 'rg-dock';
  var panels = document.createElement('div');
  panels.id = 'rg-panels';
  panels.className = 'rg-panels';
  outer.parentNode.insertBefore(row, outer);
  row.appendChild(outer);
  // The room's name line heads the map column, so the dock reaches the top.
  var head = row.parentNode.querySelector(':scope > .rd-head');
  if (head) outer.insertBefore(head, outer.firstChild);
  // The handle that resizes the dock (layout.js).
  row.insertAdjacentHTML('beforeend', '<div class="rg-split" data-split="dock" title="Drag to resize"></div>');
  row.appendChild(dock);
  dock.appendChild(panels);
  return { dock: dock, panels: panels, created: true };
}

/** Take the dock (and its splitter) away again. */
function shellDockUnmount(dock) {
  if (!dock) return;
  var split = dock.parentNode.querySelector('.rg-split');
  if (split) split.parentNode.removeChild(split);
  dock.parentNode.removeChild(dock);
}
