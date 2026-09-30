// Ownership: the Widgets tab's Placed list — one row per widget stamped on
// the map (a group, map-editor-groups.js), drawn like the Object tab's rows
// (map-editor-object-list.js): grip, where in the room, how it looks,
// `#n · name`, disband, remove.
//
// The list is the draw order: groups are composed over the map in
// `_edit.groups` order, so a later row is drawn on top of an earlier one
// where they overlap. Drag a row by its grip to change it.
//
// A placed widget is one locked thing: its tiles, triggers and objects
// move and go together. Disband (editGroupDisband) writes it into the map
// and lets its triggers and objects go, to be edited on their own.
//
// Owns: _placedDragRow.

var _placedDragRow = null;

/** Its triggers and objects, as a short phrase ('' when none). */
function placedPartsText(g) {
  var d = editDraft();
  var n = { trig: 0, obj: 0 };
  ((d && d.placed) || []).forEach(function (p) {
    if (p.removed || g.placed.indexOf(p.uid) < 0) return;
    if (p.kind === 'object') n.obj += 1; else n.trig += 1;
  });
  var out = [];
  if (n.trig) out.push(n.trig + ' trigger' + (n.trig === 1 ? '' : 's'));
  if (n.obj) out.push(n.obj + ' object' + (n.obj === 1 ? '' : 's'));
  return out.join(', ');
}

function placedRowHtml(g, n) {
  var sel = g.uid === _groupSel, locked = editLocked(), parts = placedPartsText(g);
  var title = g.name + ' — ' + g.w + '×' + g.h + ' at ' + g.x + ',' + g.y + (parts ? ', with ' + parts : '')
    + '\ndrawn #' + n + ': a later row is drawn over an earlier one'
    + (locked ? '' : '\nclick to select · drag ⠿ to reorder');
  return '<div class="rg-trigger-row rg-placed-row' + (sel ? ' on' : '') + '"' + (locked ? '' : ' draggable="true"')
    + ' data-placed-sel="' + g.uid + '" title="' + escH(title) + '">'
    + (locked ? '' : '<span class="rg-trigger-grip" aria-hidden="true">⠿</span>')
    + objectWhereSvg(g) + objectFrameThumb(g, 0, _editOrigin, 'rg-trigger-tiles')
    + '<span class="rg-trigger-label">#' + n + ' · ' + escH(g.name)
    + '<span class="rg-trigger-what">' + g.w + '×' + g.h + ' at ' + g.x + ',' + g.y + (parts ? ' · ' + escH(parts) : '') + '</span></span>'
    + (locked ? '' : '<button class="rdf rdf-xs" data-placed-disband="' + g.uid + '" title="Disband: write it into the map, and '
      + 'let its triggers and objects go — each is then edited on its own">disband</button>'
      + '<button class="rdf rg-trigger-remove" data-placed-remove="' + g.uid + '" title="Remove it, with its triggers and objects">×</button>')
    + '</div>';
}

/** The Placed list: every stamped widget, in draw order. */
function placedListHtml() {
  var d = editDraft();
  var list = (d && d.groups) || [];
  var html = '<div class="rs-note">What you stamped, in draw order — a later row is drawn over an earlier one. '
    + 'Each is locked together with its triggers and objects: move or remove it whole, or disband it to edit its parts.</div>'
    + '<div class="rg-trigger-list rg-placed-list">';
  if (!list.length) html += '<div class="rs-note">none yet — arm a widget in Library and click the map</div>';
  list.forEach(function (g, i) { html += placedRowHtml(g, i); });
  return html + '</div>';
}

/** A click the Placed list owns (map-editor-input.js). */
function placedClick(t) {
  var ds = t.dataset;
  if ((ds.placedRemove || ds.placedDisband) && editLocked()) {
    editNote('this map is locked — unlock it to change what is placed on it'); renderEditChrome(); return true;
  }
  if (ds.placedRemove) {
    if (editGroupDelete(Number(ds.placedRemove))) requestComposedPreview();
    renderEditChrome(); return true;
  }
  if (ds.placedDisband) {
    if (editGroupDisband(_mtPalette, Number(ds.placedDisband))) requestComposedPreview();
    renderEditChrome(); return true;
  }
  if (ds.placedSel) {
    var g = editGroupFind(Number(ds.placedSel));
    if (!g) return true;
    if (typeof editDeselectAll === 'function') editDeselectAll();
    _groupSel = g.uid;
    editNote(g.name + ' selected — drag it on the map with the Select tool, Delete to remove it');
    renderEditChrome(); return true;
  }
  return false;
}

// ── order ──────────────────────────────────────────────────────────────────

/** Move group `uid` to just before `beforeUid` (the end, on top, when null). One undo step. */
function placedReorder(uid, beforeUid) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g || uid === beforeUid) return;
  if (editLocked()) { editNote('this map is locked — unlock it to reorder what is placed on it'); renderEditChrome(); return; }
  var rest = d.groups.filter(function (x) { return x !== g; });
  var at = beforeUid == null ? rest.length : rest.indexOf(editGroupFind(beforeUid));
  if (at < 0) at = rest.length;
  rest.splice(at, 0, g);
  if (rest.every(function (x, i) { return x === d.groups[i]; })) return;
  editBegin();
  d.groups = rest;
  editEnd();
  editNote(g.name + ' now drawn #' + at);
  requestComposedPreview();
  renderEditChrome();
}

function placedDropRow(el) {
  return el && el.closest ? el.closest('.rg-placed-row[data-placed-sel]') : null;
}

function setupPlacedRowDrag() {
  if (typeof document === 'undefined' || !document.addEventListener || document._rgPlacedDrag) return;
  document._rgPlacedDrag = true;
  document.addEventListener('dragstart', function (e) {
    var row = placedDropRow(e.target);
    if (!row) return;
    _placedDragRow = Number(row.getAttribute('data-placed-sel'));
    row.classList.add('rg-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'placed:' + _placedDragRow); }
  });
  document.addEventListener('dragover', function (e) {
    if (_placedDragRow == null) return;
    var row = placedDropRow(e.target);
    var list = !row && e.target && e.target.closest ? e.target.closest('.rg-placed-list') : null;
    if (!row && !list) return;
    e.preventDefault();
    triggerDropClear();
    (row || list).classList.add(row ? 'rg-drop-before' : 'rg-drop-on');
  });
  document.addEventListener('drop', function (e) {
    if (_placedDragRow == null) return;
    var uid = _placedDragRow, row = placedDropRow(e.target);
    _placedDragRow = null;
    triggerDropClear();
    e.preventDefault();
    placedReorder(uid, row ? Number(row.getAttribute('data-placed-sel')) : null);
  });
  document.addEventListener('dragend', function () {
    _placedDragRow = null;
    triggerDropClear();
  });
}

setupPlacedRowDrag();
