// Ownership: groups — a stamped construct or widget kept as one thing, so a
// gourd stamped into the map can be selected, moved and deleted whole.
//
// A group remembers what it stamped (`cells`), what it covered (`under`,
// the draft's value there or null for the room's own tile) and the
// triggers and objects that came with it (`placed`, by uid). Moving puts
// `under` back, stamps the group at the new place and moves its triggers;
// deleting puts `under` back and removes them. Each is one compound step
// (editBegin/editEnd), so it undoes in one go. A cell painted over after
// stamping moves with the group: moving takes the group's footprint as it
// is now. See docs/map-format/custom-map-files.md §2.5.
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
  var d = editDraft();
  var list = (d && d.groups) || [];
  for (var i = list.length - 1; i >= 0; i--) {
    var g = list[i];
    for (var j = 0; j < g.cells.length; j++) {
      if (g.x + g.cells[j].dx === x && g.y + g.cells[j].dy === y) return g;
    }
  }
  return null;
}

function editDraftValue(x, y) {
  var d = editDraft();
  var k = editKey(x, y);
  return Object.prototype.hasOwnProperty.call(d.cells, k) ? d.cells[k] : null;
}

/**
 * Stamp a construct as a group — the Stamp tool's and the Widgets pencil's
 * one entry point. Returns the problems editConstructWrites reported.
 */
function editStampGroup(palette, construct, x, y) {
  var d = editDraft();
  var got = editConstructWrites(palette, construct, x, y);
  if (!got.writes.length) return got;
  // On the level of the floor it lands on (the bar's where there is none):
  // a widget cut from a vanilla room carries that room's level otherwise.
  if (typeof editWritesOnLevel === 'function') {
    var level = typeof editFloorLevel === 'function' ? editFloorLevel(palette, got.writes) : undefined;
    got.writes = editWritesOnLevel(palette, got.writes, level);
    got.level = level;
  }
  editBegin();
  var under = got.writes.map(function (w) { return groupRef(w.x - x, w.y - y, editDraftValue(w.x, w.y)); });
  var firstPlaced = d.placed.length;
  editApply(got.writes, got.specials);
  editStampedConstruct(construct, x, y, got.level);
  var uids = d.placed.slice(firstPlaced).map(function (p) {
    if (p.uid == null) p.uid = editNextPlacedUid();
    return p.uid;
  });
  d.groupSeq = (d.groupSeq || 0) + 1;
  (d.groups || (d.groups = [])).push({
    uid: d.groupSeq, name: construct.name, x: x, y: y,
    w: 1 + Math.max.apply(null, got.writes.map(function (w) { return w.x - x; })),
    h: 1 + Math.max.apply(null, got.writes.map(function (w) { return w.y - y; })),
    cells: got.writes.map(function (w) { return groupRef(w.x - x, w.y - y, w.index); }),
    under: under, placed: uids,
  });
  editEnd();
  _groupSel = d.groupSeq;
  return got;
}

/** Put back what a group covered; returns the group's cells as they are now. */
function editGroupLift(g) {
  var now = g.cells.map(function (c) {
    var v = editDraftValue(g.x + c.dx, g.y + c.dy);
    return v == null ? groupRef(c.dx, c.dy, editStampResolve(c.index, c.words)) : groupRef(c.dx, c.dy, v);
  });
  editApply(g.under.map(function (u) {
    return { x: g.x + u.dx, y: g.y + u.dy, index: editStampResolve(u.index, u.words) };
  }));
  return now;
}

/**
 * One cell of a group, with its stamp's words when the draft added it — a
 * group can outlive its stamps being pruned (it is kept in the history too),
 * and editStampResolve brings them back.
 */
function groupRef(dx, dy, index) {
  var r = { dx: dx, dy: dy, index: index };
  var words = editAddedWords(index);
  if (words) r.words = words;
  return r;
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
  var objects = d.placed.filter(function (p) { return p.kind === 'object' && g.placed.indexOf(p.uid) >= 0; });
  // Each object frame cell's state 0 before the move: what its floor was.
  var frameFloors = objects.map(function (o) { return groupFrameFloors(palette, o, o.x, o.y); });
  var cells = editGroupLift(g);
  // It sits over the map, not in place of it: a layer that showed the floor
  // where it was takes the floor where it lands (editRefloor), and the whole
  // of it goes on that floor's level, as when it was stamped.
  var writes = cells.map(function (c) {
    var was = editStampWords(palette, editCellAt(palette, g.x + c.dx, g.y + c.dy));
    var here = editStampWords(palette, editCellAt(palette, x + c.dx, y + c.dy));
    return { x: x + c.dx, y: y + c.dy, index: editRefloor(palette, c.index, was, here) };
  });
  var level = typeof editFloorLevel === 'function' ? editFloorLevel(palette, writes) : undefined;
  if (typeof editWritesOnLevel === 'function') writes = editWritesOnLevel(palette, writes, level);
  g.under = cells.map(function (c) { return groupRef(c.dx, c.dy, editDraftValue(x + c.dx, y + c.dy)); });
  editApply(writes);
  d.placed.forEach(function (p) {
    if (g.placed.indexOf(p.uid) >= 0) { p.x += ox; p.y += oy; }
  });
  objects.forEach(function (o, i) { groupRefloorFrames(palette, o, frameFloors[i], level); });
  cells = writes.map(function (w) { return groupRef(w.x - x, w.y - y, w.index); });
  g.cells = cells;
  g.x = x; g.y = y;
  editEnd();
  return true;
}

/** The state-0 words under each of an object's frame cells, with its corner at (x, y). */
function groupFrameFloors(palette, o, x, y) {
  var out = {};
  editObjectFrames(o).forEach(function (f) {
    Object.keys(f || {}).forEach(function (k) {
      if (k in out) return;
      var p = k.split(',');
      out[k] = editStampWords(palette, editCellAt(palette, x + Number(p[0]), y + Number(p[1])));
    });
  });
  return out;
}

/** A moved object's states, each laid over the floor its cells now sit on. */
function groupRefloorFrames(palette, o, floorsWas, level) {
  var now = groupFrameFloors(palette, o, o.x, o.y);
  o.frames = editObjectFrames(o).map(function (f) {
    var out = {};
    Object.keys(f || {}).forEach(function (k) {
      var idx = editRefloor(palette, f[k], floorsWas[k], now[k]);
      out[k] = typeof editOnLevel === 'function' ? editOnLevel(palette, idx, level) : idx;
    });
    return out;
  });
  o.layer = o.activeFrame >= 1 ? (o.frames[o.activeFrame - 1] || {}) : {};
}

/** Delete a group: what it covered comes back, its triggers go. One undo step. */
function editGroupDelete(uid) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g) return false;
  editBegin();
  editGroupLift(g);
  d.placed.forEach(function (p) { if (g.placed.indexOf(p.uid) >= 0) p.removed = true; });
  d.groups = d.groups.filter(function (o) { return o.uid !== uid; });
  editEnd();
  if (_groupSel === uid) _groupSel = null;
  editNote(g.name + ' deleted');
  return true;
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
