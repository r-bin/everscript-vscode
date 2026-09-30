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

/** `{group, part}` for every group cell at (x, y), bottom first. */
function groupPartsAt(x, y) {
  var d = editDraft();
  var list = (d && d.groups) || [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var g = list[i];
    if (x < g.x || y < g.y || x >= g.x + g.w || y >= g.y + g.h) continue;
    for (var j = 0; j < g.cells.length; j++) {
      if (g.x + g.cells[j].dx === x && g.y + g.cells[j].dy === y) { out.push({ group: g, part: g.cells[j] }); break; }
    }
  }
  return out;
}

/** `{group, part}` for the topmost group cell at (x, y), or null. */
function groupPartAt(x, y) {
  var all = groupPartsAt(x, y);
  return all.length ? all[all.length - 1] : null;
}

/**
 * What (x, y) shows: `base` (the map's stamp there) with every group there
 * over it, each over what is under it — a gourd stamped on a pasted floor
 * is on that floor, not on the bare map. A layer a group leaves null, and a
 * blank terrain, is what is under it; its collision (null: the one under
 * it) goes on the level of what is under it.
 */
function editGroupOver(palette, x, y, base) {
  var d = editDraft();
  if (!d || !d.groups || !d.groups.length) return base;
  editGroupsUpgrade(palette);
  var parts = groupPartsAt(x, y);
  if (!parts.length) return base;
  var blank = editBlankCanopy(palette);
  var w = base >= 0 ? editStampWords(palette, base) : null;
  parts.forEach(function (hit) {
    var p = hit.part;
    var level = w ? w.collision & LEVEL_BITS : (hit.group.level || 0) << 4;
    w = {
      layer1: p.layer1 != null ? p.layer1 : (w ? w.layer1 : blank),
      layer2: p.layer2 != null && p.layer2 !== blank ? p.layer2 : (w ? w.layer2 : blank),
      collision: p.collision != null ? (p.collision & ~LEVEL_BITS) | level : (w ? w.collision : level),
    };
  });
  return editAddStamp(palette, w);
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
 * Lift groups saved before they were kept apart (they have `under`: what
 * each covered when stamped). Not an undo step — the map shows the same.
 *
 * Groups stacked on one another are lifted together, not one by one: the
 * map gets back what the *first* group there covered, and each group keeps
 * only what it stamped that differs from what it covered. It reads only the
 * groups, never the map, so running it again (undo into an old step) gives
 * the same answer. A cell that changed nothing is dropped, collision
 * included, so an empty leftover cannot make a wall walkable.
 */
function editGroupsUpgrade(palette) {
  var d = editDraft();
  if (!d || !palette || !(d.groups || []).some(function (g) { return g.under; })) return;
  var blank = editBlankCanopy(palette);
  var words = function (i) { return i != null && i >= 0 ? editStampWords(palette, i) : null; };
  var first = {};
  d.groups.forEach(function (g) {
    if (!g.under) return;
    var under = {};
    g.under.forEach(function (u) { under[u.dx + ',' + u.dy] = u; });
    g._under = under;
    g.cells.forEach(function (c) {
      var k = editKey(g.x + c.dx, g.y + c.dy);
      if (!(k in first)) first[k] = under[c.dx + ',' + c.dy] || null;
    });
  });
  d.groups.forEach(function (g) {
    if (!g.under) return;
    var kept = [];
    g.cells.forEach(function (c) {
      var x = g.x + c.dx, y = g.y + c.dy, k = editKey(x, y);
      var shows = editStampResolve(c.index, c.words);
      var u = g._under[c.dx + ',' + c.dy];
      var ui = u ? editStampResolve(u.index, u.words) : null;
      var was = words(ui != null ? ui : (palette.grid && palette.grid[y] ? palette.grid[y][x] : -1));
      var w = words(shows);
      if (!w) return;
      var part = { dx: c.dx, dy: c.dy,
        layer1: was && w.layer1 === was.layer1 ? null : w.layer1,
        layer2: w.layer2 === blank || (was && w.layer2 === was.layer2) ? null : w.layer2,
        collision: was && w.collision === was.collision ? null : w.collision };
      if (part.layer1 == null && part.layer2 == null && part.collision == null) return;
      kept.push(part);
    });
    g.cells = kept;
    var lv = kept.filter(function (c) { return c.collision != null; })[0];
    g.level = lv ? (lv.collision & LEVEL_BITS) >> 4 : 1;
    delete g.under;
    delete g._under;
  });
  Object.keys(first).forEach(function (k) {
    var u = first[k];
    var ui = u ? editStampResolve(u.index, u.words) : null;
    if (ui == null) delete d.cells[k]; else d.cells[k] = ui;
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

/** The group a trigger or object (by placed uid) came with, or null. */
function editGroupOwning(uid) {
  var d = editDraft();
  if (!d || uid == null) return null;
  var list = d.groups || [];
  for (var i = 0; i < list.length; i++) if (list[i].placed.indexOf(uid) >= 0) return list[i];
  return null;
}

/** An object that came with a group sits on the map's floor, like the group. */
function editGroupOwnsObject(o) {
  return !!(o && editGroupOwning(o.uid));
}

/**
 * True, with a note saying so, when `uid` is part of a placed widget: its
 * parts are locked to it, moved and removed whole — or disbanded first.
 */
function editGroupLocks(uid) {
  var g = editGroupOwning(uid);
  if (!g) return false;
  editNote('part of the placed “' + g.name + '” — move or remove it whole, or disband it (Widgets › Placed) to edit its parts');
  if (typeof renderEditChrome === 'function') renderEditChrome();
  return true;
}

/**
 * Disband a group: what it shows is written into the map, its objects keep
 * their states as they look on that floor, and its triggers and objects are
 * let go — each edited on its own from then on. One undo step.
 */
function editGroupDisband(palette, uid) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g) return false;
  var objs = d.placed.filter(function (p) { return p.kind === 'object' && !p.removed && g.placed.indexOf(p.uid) >= 0; });
  var frames = objs.map(function (o) {
    return editObjectFrames(o).map(function (f) {
      var out = {};
      Object.keys(f || {}).forEach(function (k) { out[k] = editObjectFrameIndex(o, k, f[k]); });
      return out;
    });
  });
  // What it alone shows over the map: another group under or over it stays one.
  var all = d.groups;
  d.groups = [g];
  var writes = g.cells.filter(function (c) { return editInBounds(palette, g.x + c.dx, g.y + c.dy); })
    .map(function (c) { return { x: g.x + c.dx, y: g.y + c.dy, index: editCellAt(palette, g.x + c.dx, g.y + c.dy) }; });
  d.groups = all;
  editBegin();
  editApply(writes);
  objs.forEach(function (o, i) {
    o.frames = frames[i];
    o.layer = o.activeFrame >= 1 ? (o.frames[o.activeFrame - 1] || {}) : {};
  });
  d.groups = d.groups.filter(function (x) { return x.uid !== uid; });
  editEnd();
  if (_groupSel === uid) _groupSel = null;
  editNote(g.name + ' disbanded — its tiles are the map’s now, and its triggers and objects are edited on their own');
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
