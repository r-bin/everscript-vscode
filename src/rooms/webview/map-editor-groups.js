// Ownership: groups — a stamped construct or widget kept as one thing, over
// the map, so a gourd stamped into a hut can be selected, moved and deleted
// whole without touching the hut.
//
// A group is **stored apart from the map** and never written into
// `_edit.cells`: `cells` holds its own words per cell (`{dx, dy, layer1,
// layer2, collision}`, a null layer meaning "the map's own here"), and
// `placed` the triggers and objects that came with it (by uid). What a cell
// shows is the map's cell with the topmost group's words over it
// (editGroupOver) — composed on the fly, so the floor under a gourd stays
// the floor, wherever the gourd goes, and painting the floor under it
// changes the floor, not the gourd. Only drawing and the exports bake it in
// (editBakedCells). Moving changes `x, y`; deleting drops the group. Each is
// one compound step (editBegin/editEnd). See docs/map-format/custom-map-files.md §2.5.
//
// A group takes the level of the floor under each cell, as a stamp does.
// Its objects' states sit on the floor the same way (editObjectFrameIndex).
//
// Groups saved before v0.95.0 were written into the map and remembered
// what they covered (`under`); editGroupsUpgrade lifts them out.
//
// The Select tool picks a group before a trigger: a gourd's B-trigger
// covers the gourd, and clicking the gourd means the gourd.
//
// State: `_edit.groups`, `_edit.groupSeq` (map-editor.js, saved with the
// map). Owns: _groupSel (selected uid), _groupDrag.

var _groupSel = null;
/** `{uid, dx, dy, grabX, grabY}` while a group is being dragged. */
var _groupDrag = null;

function editGroupFind(uid) {
  var d = editDraft();
  var list = (d && d.groups) || [];
  for (var i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

/** The group whose footprint holds this cell (the latest on top), or null. */
function editGroupAt(x, y) {
  var hit = groupPartAt(x, y);
  return hit ? hit.group : null;
}

/** `{group, part}` for the topmost group cell at (x, y), or null. */
function groupPartAt(x, y) {
  var d = editDraft();
  var list = (d && d.groups) || [];
  for (var i = list.length - 1; i >= 0; i--) {
    var g = list[i];
    if (x < g.x || y < g.y || x >= g.x + g.w || y >= g.y + g.h) continue;
    for (var j = 0; j < g.cells.length; j++) {
      if (g.x + g.cells[j].dx === x && g.y + g.cells[j].dy === y) return { group: g, part: g.cells[j] };
    }
  }
  return null;
}

/**
 * What (x, y) shows: `base` (the map's stamp there) with the topmost
 * group's words over it. A layer the group leaves null, and a blank
 * terrain, is the map's; the collision is the group's on the map's level.
 */
function editGroupOver(palette, x, y, base) {
  var d = editDraft();
  if (!d || !d.groups || !d.groups.length) return base;
  editGroupsUpgrade(palette);
  var hit = groupPartAt(x, y);
  if (!hit) return base;
  var p = hit.part;
  var under = base >= 0 ? editStampWords(palette, base) : null;
  var blank = editBlankCanopy(palette);
  var l1 = p.layer1 != null ? p.layer1 : (under ? under.layer1 : blank);
  var l2 = p.layer2 != null && p.layer2 !== blank ? p.layer2 : (under ? under.layer2 : blank);
  var level = under ? under.collision & LEVEL_BITS : (hit.group.level || 0) << 4;
  return editAddStamp(palette, { layer1: l1, layer2: l2, collision: (p.collision & ~LEVEL_BITS) | level });
}

/** The map as it shows, key → stamp: the draft's cells with every group baked over them. */
function editBakedCells(palette) {
  var d = editDraft();
  if (!d) return {};
  if (!d.groups || !d.groups.length) return d.cells;
  editGroupsUpgrade(palette);
  var out = Object.assign({}, d.cells);
  d.groups.forEach(function (g) {
    g.cells.forEach(function (c) {
      var x = g.x + c.dx, y = g.y + c.dy;
      if (!editInBounds(palette, x, y)) return;
      var i = editCellAt(palette, x, y);
      if (i >= 0) out[editKey(x, y)] = i;
    });
  });
  return out;
}

/**
 * Stamp a construct as a group — the Stamp tool's and the Widgets pencil's
 * one entry point. Returns the problems editConstructParts reported, and
 * `writes`, the cells it covers.
 */
function editStampGroup(palette, construct, x, y) {
  var d = editDraft();
  var got = editConstructParts(palette, construct, x, y);
  if (!got.parts.length) return got;
  // On the level of the floor it lands on (the bar's where there is none):
  // a widget cut from a vanilla room carries that room's level otherwise.
  got.level = typeof editFloorLevel === 'function' ? editFloorLevel(palette, got.writes) : editLevel();
  editBegin();
  if (got.specials.length) editApply([], got.specials);
  var firstPlaced = d.placed.length;
  editStampedConstruct(construct, x, y, got.level);
  var uids = d.placed.slice(firstPlaced).map(function (p) {
    if (p.uid == null) p.uid = editNextPlacedUid();
    return p.uid;
  });
  d.groupSeq = (d.groupSeq || 0) + 1;
  (d.groups || (d.groups = [])).push({
    uid: d.groupSeq, name: construct.name, x: x, y: y, level: got.level,
    w: 1 + Math.max.apply(null, got.parts.map(function (c) { return c.dx; })),
    h: 1 + Math.max.apply(null, got.parts.map(function (c) { return c.dy; })),
    cells: got.parts, placed: uids,
  });
  editEnd();
  _groupSel = d.groupSeq;
  return got;
}

/**
 * Lift groups saved before they were kept apart (they have `under`): the
 * map gets back what they covered, and each cell keeps only the layers it
 * changed. Not an undo step — the map shows the same either way.
 */
function editGroupsUpgrade(palette) {
  var d = editDraft();
  if (!d || !palette || !(d.groups || []).some(function (g) { return g.under; })) return;
  var blank = editBlankCanopy(palette);
  d.groups.forEach(function (g) {
    if (!g.under) return;
    var under = {};
    g.under.forEach(function (u) { under[u.dx + ',' + u.dy] = u; });
    g.cells = g.cells.map(function (c) {
      var k = editKey(g.x + c.dx, g.y + c.dy);
      var now = Object.prototype.hasOwnProperty.call(d.cells, k) ? d.cells[k] : editStampResolve(c.index, c.words);
      var u = under[c.dx + ',' + c.dy];
      var ui = u ? editStampResolve(u.index, u.words) : null;
      if (ui == null) delete d.cells[k]; else d.cells[k] = ui;
      var was = editStampWords(palette, editBaseCellAt(palette, g.x + c.dx, g.y + c.dy));
      var w = editStampWords(palette, now) || { layer1: blank, layer2: blank, collision: 0 };
      return { dx: c.dx, dy: c.dy, collision: w.collision,
        layer1: was && w.layer1 === was.layer1 ? null : w.layer1,
        layer2: w.layer2 === blank || (was && w.layer2 === was.layer2) ? null : w.layer2 };
    });
    g.level = g.cells.length ? (g.cells[0].collision & LEVEL_BITS) >> 4 : 1;
    delete g.under;
  });
}

/** Move a group so its top-left lands at (x, y). One undo step. */
function editGroupMove(palette, uid, x, y) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g || (g.x === x && g.y === y)) return false;
  var inside = g.cells.every(function (c) { return editInBounds(palette, x + c.dx, y + c.dy); });
  if (!inside) { editNote('it does not fit there — the whole object has to stay on the map'); return false; }
  editBegin();
  var ox = x - g.x;
  var oy = y - g.y;
  d.placed.forEach(function (p) {
    if (g.placed.indexOf(p.uid) >= 0) { p.x += ox; p.y += oy; }
  });
  g.x = x; g.y = y;
  editEnd();
  return true;
}

/** Delete a group: the map under it shows again, its triggers go. One undo step. */
function editGroupDelete(uid) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g) return false;
  editBegin();
  d.placed.forEach(function (p) { if (g.placed.indexOf(p.uid) >= 0) p.removed = true; });
  d.groups = d.groups.filter(function (o) { return o.uid !== uid; });
  editEnd();
  if (_groupSel === uid) _groupSel = null;
  editNote(g.name + ' deleted');
  return true;
}

/** A group as a construct — its own words, not the floor under it — for copy and "+ From selection". */
function editGroupConstruct(palette, g) {
  var d = editDraft();
  var part = function (word) { return word == null ? null : editPartFromWord(palette, word); };
  var placed = typeof widgetPlacedIn === 'function'
    ? widgetPlacedIn(d, { x1: g.x, y1: g.y, x2: g.x + g.w - 1, y2: g.y + g.h - 1 })
    : { bTrigger: [], stepOn: [], objects: [] };
  return { name: g.name, w: g.w, h: g.h, attachments: placed,
    cells: g.cells.map(function (c) {
      return { dx: c.dx, dy: c.dy, canopy: part(c.layer1), terrain: part(c.layer2), collision: c.collision };
    }) };
}

/** An object that came with a group sits on the map's floor, like the group. */
function editGroupOwnsObject(o) {
  var d = editDraft();
  return !!(d && o && (d.groups || []).some(function (g) { return g.placed.indexOf(o.uid) >= 0; }));
}

/**
 * The Select tool on a group: down on the selected one starts a drag,
 * down on another selects it. Returns true when the gesture was a group's.
 */
function groupSelectGesture(cell, phase) {
  if (phase === 'down') {
    var g = editGroupAt(cell.x, cell.y);
    if (!g) { _groupSel = null; return false; }
    if (typeof editDeselectAll === 'function') editDeselectAll();
    _groupSel = g.uid;
    _groupDrag = { uid: g.uid, grabX: cell.x - g.x, grabY: cell.y - g.y, x: g.x, y: g.y };
    editNote(g.name + ' selected — drag to move it, Delete to remove it');
    renderEditChrome();
    return true;
  }
  if (!_groupDrag) return false;
  _groupDrag.x = cell.x - _groupDrag.grabX;
  _groupDrag.y = cell.y - _groupDrag.grabY;
  if (phase === 'move') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return true; }
  var drag = _groupDrag;
  _groupDrag = null;
  if (editGroupMove(_mtPalette, drag.uid, drag.x, drag.y)) requestComposedPreview();
  renderEditChrome();
  return true;
}

/** Down on the selected group starts dragging it; anywhere else deselects it. */
function groupDragSelected(cell) {
  var g = _groupSel != null ? editGroupFind(_groupSel) : null;
  var on = g && g.cells.some(function (c) { return g.x + c.dx === cell.x && g.y + c.dy === cell.y; });
  if (!on) { _groupSel = null; _groupDrag = null; return false; }
  _groupDrag = { uid: g.uid, grabX: cell.x - g.x, grabY: cell.y - g.y, x: g.x, y: g.y };
  return true;
}

/** Outlines: every group faintly while selecting, the selected one and its drag ghost clearly. */
function editGroupSvg(origin) {
  var d = editDraft();
  if (!d || !d.groups || !d.groups.length) return '';
  var html = '';
  var selecting = d.tool === 'select';
  d.groups.forEach(function (g) {
    var sel = g.uid === _groupSel;
    if (!sel && !selecting) return;
    html += groupBoxSvg(g.x, g.y, g, origin, sel ? 'rg-group-sel' : 'rg-group');
    if (sel && _groupDrag && _groupDrag.uid === g.uid && (_groupDrag.x !== g.x || _groupDrag.y !== g.y)) {
      html += groupBoxSvg(_groupDrag.x, _groupDrag.y, g, origin, 'rg-group-ghost');
    }
  });
  return html;
}

function groupBoxSvg(x, y, g, origin, cls) {
  var a = editCellPos(origin, x, y);
  return '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + (g.w * EDIT_UNITS)
    + '" height="' + (g.h * EDIT_UNITS) + '" pointer-events="none"><title>' + escH(g.name) + '</title></rect>';
}
