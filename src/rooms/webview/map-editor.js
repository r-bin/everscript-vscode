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
    tool: 'paint',    // paint | pick | rect | copy
    brush: -1,        // selected metatile index, -1 = none
    on: false,        // edit mode
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
