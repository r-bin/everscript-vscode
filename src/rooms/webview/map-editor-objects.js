// Ownership: the Object tab — objects on a map, and the tiles drawn over
// them.
//
// A Section 3 object is an area of the map that changes look when a script
// changes its state: a gourd breaks, a chest opens, a door slides. Vanilla
// stores each change as an XOR of the area's metatile ids
// (maps/objects.ts), so an object is its area plus *what the area turns
// into*. That second picture is a layer over the map, the way the cuttable
// layer is (map-editor-cutlayer.js): the map keeps its own tiles, and the
// object's are drawn on top of them.
//
//   pencil, outside every object   drag out a new object's area
//   pencil, on another object      select it
//   pencil, on the selected one    draw its tiles with the Tile tab's brush
//   eraser, on the selected one    take one of its tiles off
//   Select tool                    select the object under the pointer
//
// An object is a `_edit.placed` entry `{kind: 'object', uid, x, y, w, h,
// states, layer}`, `layer` being `{"dx,dy": stamp}`. So it is saved with the
// map, moves with a stamped group (map-editor-groups.js), and every change
// is part of the gesture's undo step (editBegin/editEnd snapshot `placed`).
// `layer` is replaced, never edited in place, because the snapshots copy
// entries shallowly.
//
// An object's layer is drawn only while this tab is open; elsewhere its area
// is a dashed outline, so the map reads as it loads.
//
// Owns: _objectSel (selected uid), _objectDraw (an area being dragged out),
// _objectPainting.

var _objectSel = null;
var _objectDraw = null;
var _objectPainting = false;

function editObjects() {
  var d = editDraft();
  return ((d && d.placed) || []).filter(function (p) { return p.kind === 'object' && !p.removed; });
}

function editObjectFind(uid) {
  var list = editObjects();
  for (var i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

/** The object whose area holds this cell — the smallest, as nested ones are more specific. */
function editObjectAt(x, y) {
  var best = null;
  editObjects().forEach(function (o) {
    if (x < o.x || y < o.y || x >= o.x + o.w || y >= o.y + o.h) return;
    if (!best || o.w * o.h < best.w * best.h) best = o;
  });
  return best;
}

function objectSelect(uid) {
  if (typeof editDeselectAll === 'function') editDeselectAll();
  _objectSel = uid;
  if (uid != null && typeof _editActiveTab !== 'undefined') _editActiveTab = 'object';
  var o = editObjectFind(uid);
  if (o) editNote('object #' + editObjects().indexOf(o) + ' selected — the pencil draws what its area turns into');
  renderEditChrome();
}

/** A gesture on the Object tab. Returns true when it was the object's. */
function editObjectGesture(d, cell, phase) {
  var sel = editObjectFind(_objectSel);
  var hit = editObjectAt(cell.x, cell.y);
  if (d.tool === 'select') {
    if (phase !== 'down' || !hit) return false;
    objectSelect(hit.uid);
    return true;
  }
  if (d.tool === 'erase') {
    if (sel && editObjectContains(sel, cell)) objectLayerWrite(sel, cell, true);
    return true;
  }
  if (d.tool !== 'paint') return false;
  if (phase === 'down') {
    _objectPainting = false;
    if (sel && hit && hit.uid === sel.uid) { _objectPainting = true; objectLayerWrite(sel, cell, false); return true; }
    if (hit) { objectSelect(hit.uid); return true; }
    _objectDraw = { ax: cell.x, ay: cell.y };
  }
  if (_objectDraw) {
    _objectDraw.x1 = Math.min(_objectDraw.ax, cell.x); _objectDraw.x2 = Math.max(_objectDraw.ax, cell.x);
    _objectDraw.y1 = Math.min(_objectDraw.ay, cell.y); _objectDraw.y2 = Math.max(_objectDraw.ay, cell.y);
    if (phase !== 'up') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return true; }
    var box = _objectDraw;
    _objectDraw = null;
    editAddObject(box);
    return true;
  }
  if (_objectPainting && sel && phase !== 'up' && editObjectContains(sel, cell)) objectLayerWrite(sel, cell, false);
  if (phase === 'up') _objectPainting = false;
  return true;
}

function editObjectContains(o, cell) {
  return cell.x >= o.x && cell.y >= o.y && cell.x < o.x + o.w && cell.y < o.y + o.h;
}

/** A new object over `box` (inclusive cells), selected. Part of the gesture's undo step. */
function editAddObject(box) {
  var d = editDraft();
  var uid = editNextPlacedUid();
  d.placed.push({ kind: 'object', uid: uid, x: box.x1, y: box.y1, w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1,
    states: 1, layer: {} });
  _objectSel = uid;
  editNote('object added — ' + (box.x2 - box.x1 + 1) + '×' + (box.y2 - box.y1 + 1)
    + '. Pick a tile in the Tile tab, then draw on the area what it turns into.');
  renderEditChrome();
}

/** The level a tile written at `cell` belongs on: the map's own there, else the bar's. */
function objectCellLevel(cell) {
  var i = editCellAt(_mtPalette, cell.x, cell.y);
  var w = i >= 0 ? editStampWords(_mtPalette, i) : null;
  return w ? (w.collision >> 4) & 3 : editLevel();
}

/** Draw (or erase) one tile of an object's layer with the brush. */
function objectLayerWrite(o, cell, erase) {
  var d = editDraft();
  var key = (cell.x - o.x) + ',' + (cell.y - o.y);
  var layer = Object.assign({}, o.layer || {});
  if (erase) {
    if (!(key in layer)) return;
    delete layer[key];
  } else {
    if (d.brush < 0) { editNote('pick a tile in the Tile tab first — the pencil draws it onto the object'); renderEditChrome(); return; }
    var idx = typeof editOnLevel === 'function' ? editOnLevel(_mtPalette, d.brush, objectCellLevel(cell)) : d.brush;
    if (layer[key] === idx) return;
    layer[key] = idx;
  }
  o.layer = layer;
  if (typeof editCellsChanged === 'function') editCellsChanged();
  requestComposedPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** Remove an object (the list's ×). One undo step. */
function editRemoveObject(uid) {
  var d = editDraft();
  if (!d) return;
  editBegin();
  d.placed = d.placed.filter(function (p) { return !(p.kind === 'object' && p.uid === uid); });
  editEnd();
  if (_objectSel === uid) _objectSel = null;
  editNote('object removed');
  renderEditChrome();
}

/** Stamps an object's layer uses, for pruning and the family sync (map-editor-stamps.js, -families.js). */
function editObjectStamps() {
  var out = [];
  editObjects().forEach(function (o) {
    Object.keys(o.layer || {}).forEach(function (k) { out.push(o.layer[k]); });
  });
  return out;
}

// ── drawing ────────────────────────────────────────────────────────────────

/** Areas as dashed outlines; with the tab open, each object's tiles over the map. */
function editObjectSvg(palette, composed, origin) {
  var open = typeof _editActiveTab !== 'undefined' && _editActiveTab === 'object';
  var html = '';
  editObjects().forEach(function (o) {
    if (open) {
      Object.keys(o.layer || {}).forEach(function (k) {
        var p = k.split(',');
        var pos = editCellPos(origin, o.x + Number(p[0]), o.y + Number(p[1]));
        html += editStampSvg(palette, composed, o.layer[k], pos.x, pos.y, 'rg-edit-cell rg-obj-cell');
      });
    }
    var a = editCellPos(origin, o.x, o.y);
    html += '<rect class="rg-obj-area' + (o.uid === _objectSel ? ' sel' : '') + '" x="' + a.x + '" y="' + a.y
      + '" width="' + (o.w * EDIT_UNITS) + '" height="' + (o.h * EDIT_UNITS) + '"/>';
  });
  if (_objectDraw && _objectDraw.x1 != null) {
    var b = editCellPos(origin, _objectDraw.x1, _objectDraw.y1);
    html += '<rect class="rg-obj-area rg-obj-drag" x="' + b.x + '" y="' + b.y + '" width="'
      + ((_objectDraw.x2 - _objectDraw.x1 + 1) * EDIT_UNITS) + '" height="' + ((_objectDraw.y2 - _objectDraw.y1 + 1) * EDIT_UNITS) + '"/>';
  }
  return html;
}

// ── the tab ────────────────────────────────────────────────────────────────

/** One row: where the object is, what it turns into, `#n · W×H · k tiles`, remove. */
function objectRowHtml(o, n) {
  var W = _mtPalette && _mtPalette.widthTiles;
  var H = _mtPalette && _mtPalette.heightTiles;
  var org = _editOrigin;
  var a = editCellPos(org, o.x, o.y);
  var bw = o.w * EDIT_UNITS;
  var bh = o.h * EDIT_UNITS;
  var tiles = '';
  Object.keys(o.layer || {}).forEach(function (k) {
    var p = k.split(',');
    var pos = editCellPos(org, o.x + Number(p[0]), o.y + Number(p[1]));
    tiles += editStampSvg(_mtPalette, _editComposed, o.layer[k], pos.x, pos.y, 'rg-edit-cell');
  });
  var drawn = Object.keys(o.layer || {}).length;
  return '<div class="rg-trigger-row rg-object-row' + (o.uid === _objectSel ? ' on' : '') + '" data-object-sel="' + o.uid
    + '" title="' + escH('object at ' + o.x + ',' + o.y + ', ' + o.w + '×' + o.h
      + '\n' + (drawn ? drawn + ' tile' + (drawn === 1 ? '' : 's') + ' drawn for its changed look' : 'nothing drawn yet')
      + (o.states > 1 ? '\n' + (o.states + 1) + ' looks in vanilla; the first change is the one shown' : '')) + '">'
    + (W && H ? '<svg class="rg-trigger-where" viewBox="' + org.x + ' ' + org.y + ' ' + (W * EDIT_UNITS) + ' ' + (H * EDIT_UNITS)
      + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g class="rg-trigger-where-map"><use href="#rg-img"/>'
      + '<use href="#rg-edit-tiles"/></g><rect class="rg-object-where-box" x="' + a.x + '" y="' + a.y + '" width="' + bw
      + '" height="' + bh + '"/></svg>' : '')
    + '<svg class="rg-trigger-tiles" viewBox="' + a.x + ' ' + a.y + ' ' + bw + ' ' + bh
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#rg-img"/><use href="#rg-edit-tiles"/>'
    + tiles + '</svg>'
    + '<span class="rg-trigger-label">#' + n + ' · ' + o.w + '×' + o.h + ' · ' + drawn + ' drawn</span>'
    + '<button class="rdf rg-trigger-remove" data-object-remove="' + o.uid + '" title="Remove this object">×</button>'
    + '</div>';
}

function objectTabHtml() {
  var list = editObjects();
  var html = '<div class="rs-note">An object is an area that changes when a script changes its state — a gourd '
    + 'breaks, a chest opens. Drag out its area with the pencil, then, with it selected, draw what the area '
    + 'turns into using the Tile tab\'s brush. Its tiles sit on top of the map, like the cuttable layer, and '
    + 'show only while this tab is open.</div>'
    + '<div class="rg-trigger-list">';
  if (!list.length) html += '<div class="rs-note">none yet — drag an area on the map with the pencil</div>';
  list.forEach(function (o, i) { html += objectRowHtml(o, i); });
  html += '</div>';
  var own = (_mtPalette && _mtPalette.attachments && _mtPalette.attachments.objects) || [];
  if (own.length) html += '<div class="rs-note">This room also has ' + own.length + ' object' + (own.length === 1 ? '' : 's')
    + ' of its own (Objects in the bottom bar shows them).</div>';
  return html;
}

/** A click the Object tab owns (map-editor-input.js). */
function objectClick(t) {
  if (t.dataset.objectRemove) { editRemoveObject(Number(t.dataset.objectRemove)); return true; }
  if (t.dataset.objectSel) { objectSelect(Number(t.dataset.objectSel)); return true; }
  return false;
}
