// Ownership: the Object tab's list — one row per object, drawn like the
// Trigger tab's rows (map-editor-trigger-panel.js): grip, where in the room,
// how it looks on the map now, `#n · size at x,y`, remove. Drag a row by its
// grip to reorder. Under the row, its states as chips.
//
// An object whose states all look the same starts collapsed: a room seeds
// sniff spots as objects with nothing to show. Every other object, and the
// selected one, starts open; the caret overrides either way.
//
// The object model (frames, painting, the map overlay) is map-editor-objects.js.
//
// Owns: _objectOpen ("<map>:<uid>" → the caret's explicit open/closed; uids repeat
// across maps), _objectDragRow.

var _objectOpen = {}, _objectDragRow = null;

/** True when no state changes a cell's look: every frame's tiles are the map's own. */
function objectLooksStatic(o) {
  return editObjectFrames(o).every(function (f) {
    return Object.keys(f || {}).every(function (k) {
      var p = k.split(','), here = editCellAt(_mtPalette, o.x + Number(p[0]), o.y + Number(p[1]));
      var at = editObjectFrameIndex(o, k, f[k]);
      if (at === here) return true;
      var a = editStampWords(_mtPalette, at), b = editStampWords(_mtPalette, here);
      return !!(a && b && a.layer1 === b.layer1 && a.layer2 === b.layer2);
    });
  });
}

/** The caret's key: uids start at 1 in every map, so a map's own. */
function objectOpenKey(o) {
  var d = editDraft();
  return (d ? d.customKey || d.roomId : '') + ':' + o.uid;
}

function objectIsOpen(o) {
  var k = objectOpenKey(o);
  if (Object.prototype.hasOwnProperty.call(_objectOpen, k)) return _objectOpen[k];
  return o.uid === _objectSel || !objectLooksStatic(o);
}

/** The area as it looks in state `frameIdx`: the map under it, that frame's tiles over it. */
function objectFrameThumb(o, frameIdx, org, cls) {
  var a = editCellPos(org, o.x, o.y), bw = o.w * EDIT_UNITS, bh = o.h * EDIT_UNITS;
  var maxDim = Math.max(o.w, o.h, 1), tiles = '';
  if (frameIdx >= 1) {
    var layer = editObjectFrames(o)[frameIdx - 1] || {};
    Object.keys(layer).forEach(function (k) {
      var p = k.split(','), pos = editCellPos(org, o.x + Number(p[0]), o.y + Number(p[1]));
      tiles += editStampSvg(_mtPalette, _editComposed, editObjectFrameIndex(o, k, layer[k]), pos.x, pos.y, 'rg-edit-cell');
    });
  }
  var size = cls ? 'class="' + cls + '"'
    : 'class="ro-img" width="' + Math.round(30 * o.w / maxDim) + '" height="' + Math.round(30 * o.h / maxDim) + '"';
  return '<svg ' + size + ' viewBox="' + a.x + ' ' + a.y + ' ' + bw + ' ' + bh
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#rg-img"/><use href="#rg-edit-tiles"/>' + tiles + '</svg>';
}

/** Where the object sits in the room: the whole room, dimmed, its area lit. */
function objectWhereSvg(o) {
  var W = _mtPalette && _mtPalette.widthTiles, H = _mtPalette && _mtPalette.heightTiles;
  if (!W || !H) return '';
  var org = _editOrigin, b = editCellPos(org, o.x, o.y);
  return '<svg class="rg-trigger-where" viewBox="' + org.x + ' ' + org.y + ' ' + (W * EDIT_UNITS) + ' ' + (H * EDIT_UNITS)
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g class="rg-trigger-where-map">'
    + '<use href="#rg-img"/><use href="#rg-edit-tiles"/></g><rect class="rg-object-where-box" x="' + b.x + '" y="' + b.y
    + '" width="' + (o.w * EDIT_UNITS) + '" height="' + (o.h * EDIT_UNITS) + '"/></svg>';
}

/** The state chips and, on a changed state, its bar. */
function objectStatesHtml(o, n) {
  var org = _editOrigin, frames = editObjectFrames(o), sel = o.uid === _objectSel;
  var active = sel ? _objectActiveFrame : (o.activeFrame || 0);
  // Each state with its hold under it, as the Animation tab's frames (map-editor-object-holds.js).
  var hold = function (s) { return typeof objectHoldCellHtml === 'function' ? objectHoldCellHtml(o, s) : ''; };
  var h = '<div class="rg-object-expanded"><div class="ro-chips">'
    + '<div class="rg-anim-frame-col"><button class="ro-chip' + (active === 0 ? ' sel' : '') + '" data-object-uid="' + o.uid + '" data-object-frame="0"'
    + ' title="State 0 — the look the room loads with">' + objectFrameThumb(o, 0, org) + '<span class="ro-lbl">0</span></button>' + hold(0) + '</div>';
  for (var f = 1; f <= frames.length; f++) {
    var b = objectFrameBounds(frames[f - 1]);
    var tip = 'Frame ' + f + (b ? ' — ' + b.w + '×' + b.h + ' (' + b.count + ' delta tiles)' : ' — same as base');
    h += '<div class="rg-anim-frame-col"><button class="ro-chip' + (active === f ? ' sel' : '') + '" data-object-uid="' + o.uid + '" data-object-frame="' + f
      + '" title="' + escH(tip) + '">' + objectFrameThumb(o, f, org) + '<span class="ro-lbl">' + f + '</span></button>' + hold(f) + '</div>';
  }
  h += '<button class="ro-chip ro-chip-add" data-object-add-frame="' + o.uid + '" title="Add new frame to obj #' + n + '">+</button></div>';
  if (typeof objectTimingHtml === 'function') h += objectTimingHtml(o);
  if (sel && _objectActiveFrame >= 1) {
    var cur = objectFrameBounds(frames[_objectActiveFrame - 1]), prevF = _objectActiveFrame - 1, nextF = _objectActiveFrame + 1;
    h += '<div class="rg-object-frame-bar"><span class="rg-obj-frame-info">Frame ' + _objectActiveFrame + ': '
      + (cur ? cur.w + '×' + cur.h + ' (' + cur.count + ' delta tiles)' : 'same as base') + '</span>'
      + '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-frame="' + prevF + '" title="'
      + (prevF === 0 ? 'State 0 (base)' : 'Frame ' + prevF) + '">◀</button>'
      + '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-frame="' + nextF + '" title="Frame ' + nextF + '"'
      + (_objectActiveFrame >= frames.length ? ' disabled' : '') + '>▶</button>'
      + (_confirmRemoveFrame === _objectActiveFrame
        ? '<button class="rdf rdf-xs rdf-warn" data-object-uid="' + o.uid + '" data-object-confirm-remove-frame="' + _objectActiveFrame
          + '" title="Confirm delete">Delete?</button><button class="rdf rdf-xs" data-object-cancel-remove-frame="1" title="Cancel">Cancel</button>'
        : '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-remove-frame="' + _objectActiveFrame
          + '" title="Remove frame ' + _objectActiveFrame + '">Delete frame</button>')
      + '</div>';
  }
  return h + '</div>';
}

/** The number a script's `SET OBJ` names: the room's own, else its place in the list. */
function objectNumber(o, n) {
  return o.roomObject != null ? o.roomObject : o.objectIndex != null ? o.objectIndex : n;
}

/**
 * What a trigger's script does with this object, as the Trigger tab says it:
 * a gourd's or a chest's B-trigger hands over loot naming the object by
 * number (`loot[].objectId`), and its Everscript names it the same way
 * (`_loot_chest(0x03, OIL);`). '' when no script names it.
 */
function objectScriptWhat(o, n) {
  if (typeof triggerScriptFor !== 'function' || typeof editTriggerList !== 'function') return '';
  var num = objectNumber(o, n), arg = '(0x' + ('0' + num.toString(16)).slice(-2);
  var out = '';
  ['b', 'step'].some(function (kind) {
    return editTriggerList(kind).some(function (t) {
      var s = triggerScriptFor(t, kind);
      if (!s || !(s.loot || []).some(function (f) { return f && f.objectId === num; })) return false;
      var code = (s.everscript || []).filter(function (c) { return c && c.indexOf(arg + ',') >= 0; })[0];
      out = code || triggerScriptWhat(s);
      return true;
    });
  });
  return out;
}

/** One object: grip, where, its look now, `#n · size at x,y`, remove — and its states when open. */
function objectRowHtml(o, n) {
  var frames = editObjectFrames(o), sel = o.uid === _objectSel, open = objectIsOpen(o), still = objectLooksStatic(o);
  var locked = editLocked(), what = objectScriptWhat(o, n);
  var title = 'obj #' + n + ' — ' + o.w + '×' + o.h + ' tiles at ' + o.x + ',' + o.y + ', ' + (frames.length + 1) + ' states'
    + (still ? ', all alike (a sniff spot?)' : '')
    + (o.roomObject != null ? '\nthe room’s own object ' + o.roomObject : '')
    + (locked ? '' : '\nclick to select · drag ⠿ to reorder');
  return '<div class="rg-object-card' + (sel ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-object-row' + (sel ? ' on' : '') + '"' + (locked ? '' : ' draggable="true"') + ' data-object-sel="' + o.uid
    + '" title="' + escH(title) + '">'
    + (locked ? '' : '<span class="rg-trigger-grip" aria-hidden="true">⠿</span>')
    + objectWhereSvg(o) + objectFrameThumb(o, sel ? _objectActiveFrame : (o.activeFrame || 0), _editOrigin, 'rg-trigger-tiles')
    + '<span class="rg-trigger-label">#' + n + ' · ' + o.w + '×' + o.h + ' tiles'
    + (still ? ' <span class="rg-object-still">no change</span>' : '')
    + (what ? '<span class="rg-trigger-what">' + scriptHighlight(what) + '</span>' : '') + '</span>'
    + '<span class="rg-object-caret" data-object-toggle="' + o.uid + '" title="' + (open ? 'Hide' : 'Show') + ' its states">'
    + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-object-remove="' + o.uid + '" title="Remove this object">×</button>') + '</div>'
    + (open ? objectStatesHtml(o, n) : '') + '</div>';
}

function objectTabHtml() {
  var list = editObjects();
  var hasLoot = list.map(function (o, i) { return !!objectScriptWhat(o, i); });
  var loot = hasLoot.filter(Boolean).length;
  var html = '<div class="rs-note">Areas that change look when a script sets their state. The pencil drags out a new '
    + 'one; with one selected it draws that state’s tiles. Drag a row by ⠿ to reorder.</div>'
    + (loot && typeof lootFilterHtml === 'function' ? lootFilterHtml('object', loot) : '') + '<div class="rg-trigger-list">';
  if (!list.length) html += '<div class="rs-note">none yet — drag an area on the map with the pencil</div>';
  list.forEach(function (o, i) {
    if (!loot || !_lootOnly.object || hasLoot[i]) html += objectRowHtml(o, i);
  });
  return html + '</div>';
}

/** A click the Object tab owns (map-editor-input.js). */
function objectClick(t) {
  var ds = t.dataset;
  if ((ds.objectRemove || ds.objectAddFrame || ds.objectRemoveFrame || ds.objectConfirmRemoveFrame || ds.objectMoveFrame)
    && editLocked()) {
    editNote('this map is locked — unlock it to change its objects'); renderEditChrome(); return true;
  }
  if (t.dataset.objectPlay) { objectPlay(Number(t.dataset.objectPlay)); return true; }
  if (t.dataset.objectRemove) { editRemoveObject(Number(t.dataset.objectRemove)); return true; }
  if (t.dataset.objectToggle) {
    var o = editObjectFind(Number(t.dataset.objectToggle));
    if (o) _objectOpen[objectOpenKey(o)] = !objectIsOpen(o);
    renderEditChrome();
    return true;
  }
  if (t.dataset.objectSel) { objectSelect(Number(t.dataset.objectSel)); return true; }
  if (t.dataset.objectFrame) { objectSelectFrame(Number(t.dataset.objectFrame), t.dataset.objectUid ? Number(t.dataset.objectUid) : undefined); return true; }
  if (t.dataset.objectAddFrame) { objectAddFrame(Number(t.dataset.objectAddFrame)); return true; }
  if (t.dataset.objectRemoveFrame) { _confirmRemoveFrame = Number(t.dataset.objectRemoveFrame); renderEditChrome(); return true; }
  if (t.dataset.objectConfirmRemoveFrame) { objectRemoveFrame(Number(t.dataset.objectUid), Number(t.dataset.objectConfirmRemoveFrame)); return true; }
  if (t.dataset.objectCancelRemoveFrame) { _confirmRemoveFrame = null; renderEditChrome(); return true; }
  if (t.dataset.objectMoveFrame) { objectMoveFrame(Number(t.dataset.objectUid), Number(t.dataset.objectMoveFrame)); return true; }
  return false;
}

// ── order ──────────────────────────────────────────────────────────────────

/** Move object `uid` to just before `beforeUid` (the end when null). One undo step. */
function objectReorder(uid, beforeUid) {
  var d = editDraft();
  var o = editObjectFind(uid);
  if (!d || !o || uid === beforeUid) return;
  if (editLocked()) { editNote('this map is locked — unlock it to reorder its objects'); renderEditChrome(); return; }
  var objs = editObjects().filter(function (p) { return p !== o; });
  var at = beforeUid == null ? objs.length : objs.indexOf(editObjectFind(beforeUid));
  if (at < 0) at = objs.length;
  objs.splice(at, 0, o);
  if (objs.every(function (p, i) { return p === editObjects()[i]; })) return;
  editBegin();
  // The objects keep their slots among the other placed things; only their order changes.
  var k = 0;
  d.placed = d.placed.map(function (p) { return p.kind === 'object' && !p.removed ? objs[k++] : p; });
  editEnd();
  editNote('object moved to #' + at);
  renderEditChrome();
}

function objectDropRow(el) {
  return el && el.closest ? el.closest('.rg-object-row[data-object-sel]') : null;
}

function setupObjectRowDrag() {
  if (typeof document === 'undefined' || !document.addEventListener || document._rgObjectDrag) return;
  document._rgObjectDrag = true;
  document.addEventListener('dragstart', function (e) {
    var row = objectDropRow(e.target);
    if (!row) return;
    _objectDragRow = Number(row.getAttribute('data-object-sel'));
    row.classList.add('rg-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'object:' + _objectDragRow); }
  });
  document.addEventListener('dragover', function (e) {
    if (_objectDragRow == null) return;
    var row = objectDropRow(e.target);
    var list = !row && e.target && e.target.closest ? e.target.closest('.rg-trigger-list') : null;
    if (!row && !list) return;
    e.preventDefault();
    triggerDropClear();
    (row || list).classList.add(row ? 'rg-drop-before' : 'rg-drop-on');
  });
  document.addEventListener('drop', function (e) {
    if (_objectDragRow == null) return;
    var uid = _objectDragRow, row = objectDropRow(e.target);
    _objectDragRow = null;
    triggerDropClear();
    e.preventDefault();
    objectReorder(uid, row ? Number(row.getAttribute('data-object-sel')) : null);
  });
  document.addEventListener('dragend', function () {
    _objectDragRow = null;
    triggerDropClear();
  });
}

setupObjectRowDrag();
