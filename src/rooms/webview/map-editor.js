// Ownership: the map editor's **state** — what has been drawn, what has
// been composed, and the undo stack. No DOM, no markup: map-editor-ui.js
// draws it and map-editor-paint.js drives it.
//
// Nothing here writes to the ROM. An edit lives in this draft until it is
// exported; see docs/map-format/map_editor_ui.md §6 for where the draft
// plugs into the verified Python encoder.
//
// Owns: _edit. Only this file assigns to it.

/**
 * The draft for the room on screen.
 *
 * `cells` is keyed `"x,y"` in metatile coordinates (a metatile is 16px,
 * two units of the map's 8px grid). `added` are stamps the composer has
 * made: their index continues past the room's own dictionary, so index
 * `count + n` is `added[n]`, which is exactly how they would be appended to
 * Block 3.
 */
var _edit = null;

/** A fresh draft for a room. Discards whatever was being edited. */
function editReset(roomId) {
  _edit = {
    roomId: roomId,
    cells: {},        // "x,y" -> metatile index
    added: [],        // {layer1, layer2, collision}
    undo: [],
    redo: [],
    tool: 'paint',    // paint | pick | rect | copy | move | erase
    brush: -1,        // selected metatile index, -1 = none
    on: false,        // edit mode
    // Which question a stroke is answering. 'room' lays out the place
    // itself and writes all three words; 'deco' puts things *on* it and
    // keeps the floor that is already there. See editResolve.
    phase: 'room',
    /** Saved multi-cell constructs — see editSaveConstruct. */
    constructs: [],
    /** A blank room being drafted instead of a ROM room, or null. */
    blank: null,
  };
  return _edit;
}

function editActive() { return !!(_edit && _edit.on); }
function editDraft() { return _edit; }
function editKey(x, y) { return x + ',' + y; }

/** How many stamps exist for this room, the room's own plus composed ones. */
function editStampCount(palette) {
  return (palette ? palette.count : 0) + (_edit ? _edit.added.length : 0);
}

/**
 * Apply a list of `{x, y, index}` writes as one undoable step.
 *
 * Batched rather than per-cell so a rectangle fill or a paste undoes in one
 * go, which is what makes "move the window back" a single keystroke.
 */
function editApply(writes) {
  if (!_edit || !writes.length) return 0;
  var before = [];
  var changed = 0;
  for (var i = 0; i < writes.length; i++) {
    var w = writes[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.cells, k) ? _edit.cells[k] : null;
    if (was === w.index) continue;
    before.push({ x: w.x, y: w.y, index: was });
    _edit.cells[k] = w.index;
    changed += 1;
  }
  if (!changed) return 0;
  _edit.undo.push(before);
  _edit.redo.length = 0;
  return changed;
}

/** Put a batch of `{x, y, index}` back, where `index === null` clears. */
function editRestore(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.cells, k) ? _edit.cells[k] : null;
    inverse.push({ x: w.x, y: w.y, index: was });
    if (w.index === null) delete _edit.cells[k];
    else _edit.cells[k] = w.index;
  }
  return inverse;
}

function editUndo() {
  if (!_edit || !_edit.undo.length) return false;
  _edit.redo.push(editRestore(_edit.undo.pop()));
  return true;
}

function editRedo() {
  if (!_edit || !_edit.redo.length) return false;
  _edit.undo.push(editRestore(_edit.redo.pop()));
  return true;
}

/**
 * Add a composed stamp, or return the index of an identical one.
 *
 * Reuse first, because a dictionary entry is not free: an editor that
 * appends on every click turns a 500-entry dictionary into thousands. The
 * room's own spare slots are offered separately by the UI; this only
 * deduplicates within the draft.
 */
function editAddStamp(palette, draft) {
  if (!_edit) return -1;
  var base = palette ? palette.count : 0;
  for (var i = 0; i < _edit.added.length; i++) {
    var a = _edit.added[i];
    if (a.layer1 === draft.layer1 && a.layer2 === draft.layer2 && a.collision === draft.collision) {
      return base + i;
    }
  }
  // An exact match already in the room costs nothing at all.
  if (palette) {
    for (var j = 0; j < palette.count; j++) {
      var e = palette.entries[j];
      if (e[1] === draft.layer1 && e[2] === draft.layer2 && e[3] === draft.collision) return j;
    }
  }
  _edit.added.push({ layer1: draft.layer1, layer2: draft.layer2, collision: draft.collision });
  return base + _edit.added.length - 1;
}

/** The three words of a stamp, whether it is the room's or the draft's. */
function editStampWords(palette, index) {
  var base = palette ? palette.count : 0;
  if (index >= base) {
    var a = _edit && _edit.added[index - base];
    return a ? { layer1: a.layer1, layer2: a.layer2, collision: a.collision, added: true } : null;
  }
  var e = palette && palette.entries[index];
  return e ? { layer1: e[1], layer2: e[2], collision: e[3], added: false } : null;
}

// ---------------------------------------------------------------------------
// Layer phases: what a stroke actually writes.
// ---------------------------------------------------------------------------

/**
 * The room's blank canopy word — what "no decoration here" looks like.
 *
 * Derived rather than hardcoded, but it is `$A800` in every room measured:
 * 140 placements in room 0x34, 2034 in 0x76, 3800 in 0x38. Room 0x34's
 * graphic at that word has **zero** non-transparent pixels, so erasing to it
 * really does erase.
 */
function editBlankCanopy(palette) {
  if (!palette || !palette.count) return 0xa800;
  var counts = {};
  var best = 0xa800;
  var bestN = -1;
  for (var i = 0; i < palette.count; i++) {
    var e = palette.entries[i];
    if (!e[4]) continue;
    var w = e[1];
    counts[w] = (counts[w] || 0) + e[4];
    if (counts[w] > bestN) { bestN = counts[w]; best = w; }
  }
  return best;
}

/**
 * How the room normally behaves on this terrain.
 *
 * Used when erasing: taking the decoration's picture away should take its
 * collision with it, or removing a gourd would leave a hole you still
 * cannot walk through. The room's own most-placed stamp on that terrain is
 * the evidence for what the bare floor does.
 */
function editFloorCollisionFor(palette, layer2Word) {
  if (!palette) return null;
  var best = null;
  var bestN = -1;
  for (var i = 0; i < palette.count; i++) {
    var e = palette.entries[i];
    if (e[2] !== layer2Word || !e[4]) continue;
    if (e[4] > bestN) { bestN = e[4]; best = e[3]; }
  }
  return best;
}

/**
 * The stamp a stroke should write at this cell.
 *
 * This is where the phase split lives, and it is the whole of the "first
 * draw the room, then fill it with deco" model:
 *
 * - **room**: the brush wins outright. All three words are replaced, which
 *   is what laying out a floor or a wall means.
 * - **deco**: the brush supplies the canopy and the collision, the cell
 *   keeps its terrain. Putting a gourd on a floor must not replace the
 *   floor — in room 0x34 the decorations are canopy words over an unchanged
 *   terrain word, which is exactly this operation.
 * - **erase** (deco): the canopy goes back to blank and the collision goes
 *   back to whatever the room does on bare ground of that terrain.
 *
 * Returns a metatile index, creating one through the usual find-or-create
 * rule if the combination does not exist yet.
 */
function editResolve(palette, x, y, brushIndex, phase, erasing) {
  var here = editCellAt(palette, x, y);
  var under = here >= 0 ? editStampWords(palette, here) : null;
  if (phase !== 'deco' || !under) {
    if (erasing) return -1;
    return brushIndex;
  }

  if (erasing) {
    var blank = editBlankCanopy(palette);
    if (under.layer1 === blank) return here; // already bare: nothing to erase
    var restored = editFloorCollisionFor(palette, under.layer2);
    return editAddStamp(palette, {
      layer1: blank,
      layer2: under.layer2,
      collision: restored === null ? under.collision : restored,
    });
  }

  var brush = editStampWords(palette, brushIndex);
  if (!brush) return -1;
  return editAddStamp(palette, {
    layer1: brush.layer1,
    layer2: under.layer2,
    collision: brush.collision,
  });
}

/**
 * Save a rectangle of the map as a reusable construct.
 *
 * The stamps are stored as *words*, not indices, so the construct survives
 * being stamped into a room with a different dictionary. Triggers and
 * objects whose rectangle overlaps the selection come with it — that is the
 * difference between a gourd, which is metatiles plus a B-trigger plus an
 * object, and a hide, which is only metatiles.
 */
function editSaveConstruct(palette, sel, name) {
  if (!_edit || !sel || !palette) return null;
  var cells = [];
  for (var y = sel.y1; y <= sel.y2; y++) {
    for (var x = sel.x1; x <= sel.x2; x++) {
      var idx = editCellAt(palette, x, y);
      var w = idx >= 0 ? editStampWords(palette, idx) : null;
      if (!w) continue;
      cells.push({ dx: x - sel.x1, dy: y - sel.y1, layer1: w.layer1, layer2: w.layer2, collision: w.collision });
    }
  }
  if (!cells.length) return null;
  var construct = {
    name: name || ('construct ' + (_edit.constructs.length + 1)),
    w: sel.x2 - sel.x1 + 1,
    h: sel.y2 - sel.y1 + 1,
    cells: cells,
    attachments: editAttachmentsIn(palette, sel),
  };
  _edit.constructs.push(construct);
  return construct;
}

/** Triggers and objects whose rectangle overlaps this selection. */
function editAttachmentsIn(palette, sel) {
  var a = palette && palette.attachments;
  var out = { bTrigger: [], stepOn: [], objects: [] };
  if (!a) return out;
  var overlaps = function (x1, y1, x2, y2) {
    return x1 <= sel.x2 && x2 >= sel.x1 && y1 <= sel.y2 && y2 >= sel.y1;
  };
  ['bTrigger', 'stepOn'].forEach(function (kind) {
    (a[kind] || []).forEach(function (t) {
      if (overlaps(t[0], t[1], t[2], t[3])) {
        out[kind].push({ dx: t[0] - sel.x1, dy: t[1] - sel.y1, w: t[2] - t[0], h: t[3] - t[1], scriptId: t[4] });
      }
    });
  });
  (a.objects || []).forEach(function (o) {
    if (overlaps(o[0], o[1], o[0] + o[2] - 1, o[1] + o[3] - 1)) {
      out.objects.push({ dx: o[0] - sel.x1, dy: o[1] - sel.y1, w: o[2], h: o[3], objectIndex: o[4] });
    }
  });
  return out;
}

/** The writes that stamp a construct with its top-left at (x, y). */
function editConstructWrites(palette, construct, x, y) {
  var writes = [];
  if (!construct) return writes;
  for (var i = 0; i < construct.cells.length; i++) {
    var c = construct.cells[i];
    var cx = x + c.dx;
    var cy = y + c.dy;
    if (!editInBounds(palette, cx, cy)) continue;
    writes.push({
      x: cx, y: cy,
      index: editAddStamp(palette, { layer1: c.layer1, layer2: c.layer2, collision: c.collision }),
    });
  }
  return writes;
}

/**
 * The stamps this draft needs that the room does not already define.
 *
 * The "metatiles calculated to be needed by the creation" — every composed
 * stamp, plus what it costs. Placing the same construct twice adds nothing,
 * because `editAddStamp` deduplicates first.
 */
function editNeededStamps(palette) {
  if (!_edit) return { added: [], bytes: 0 };
  var base = palette ? palette.count : 0;
  return {
    added: _edit.added.map(function (a, i) {
      return { index: base + i, layer1: a.layer1, layer2: a.layer2, collision: a.collision };
    }),
    bytes: _edit.added.length * 8,
  };
}

/**
 * The draft as the shape `rebuild_model` wants.
 *
 * Cell writes are grid coordinates and metatile **ids**, because that is
 * what `layer1_metatile_ids` holds; composed stamps are appended to the
 * Block 3 slices in order. Nothing here applies it — this is the handover
 * format, and the write itself needs a confirmation the extension does not
 * have yet.
 */
function editExport(palette) {
  if (!_edit) return null;
  var base = palette ? palette.baseMetatile : 0;
  var count = palette ? palette.count : 0;
  var cells = [];
  Object.keys(_edit.cells).forEach(function (k) {
    var p = k.split(',');
    cells.push({ x: Number(p[0]), y: Number(p[1]), metatileId: base + _edit.cells[k] * 8 });
  });
  cells.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  return {
    roomId: _edit.roomId,
    baseMetatile: base,
    originalMetatileCount: count,
    cells: cells,
    appendMetatiles: _edit.added.map(function (a) {
      return { layer1: a.layer1, layer2: a.layer2, collision: a.collision };
    }),
  };
}
