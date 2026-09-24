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
    /**
     * The Special tab's own overlay: "x,y" -> a special id from
     * map-editor-special.js's catalog (e.g. "gate-dog", "entrance-n").
     *
     * Cosmetically independent of `brush`/`cells` — picking a tile does not
     * clear this, and picking a special does not clear the brush (the
     * mock's own note). Gate and drift picks *also* modify the cell's
     * stamp (a real collision-word write, see map-editor-special.js); this
     * map is what draws the glyph and is never exported — see editExport.
     */
    specialCells: {},
    /** The special armed for painting, or null. Set directly, like `tool`/`brush`. */
    currentSpecialId: null,
    /** Saved multi-cell constructs — see editSaveConstruct. */
    constructs: [],
    /**
     * Graphics the draft has pulled in that Block 1 did not load.
     *
     * Appended after the room's own list, so a graphic's slot is
     * `tiles.count + i` and its `chr` follows from that. Each one costs a
     * graphics slot, which is what the budget meter is counting.
     */
    addedGraphics: [],
    /**
     * What placed constructs owe the room beyond their metatiles.
     *
     * A gourd is art **plus** an object record plus a B-trigger pointing at
     * a script. Stamping only the art gives a picture of a gourd; these are
     * the other two, kept so the export can write them.
     */
    placed: [],
    /** A blank room being drafted instead of a ROM room, or null. */
    blank: null,
    /**
     * Base-room triggers (from `_mtPalette.attachments`) this draft has
     * hidden — `{kind: 'step'|'b', index}`, index into that kind's
     * attachments array. A base trigger is never mutated in place (it isn't
     * this draft's to rewrite); "moving" or "deleting" one marks it here and,
     * for a move, adds the new position to `placed` instead. See
     * map-editor-trigger-select.js, which is the only file that pushes to
     * this besides editUndo/editRedo restoring a snapshot of it.
     */
    removedTriggers: [],
    /**
     * Which trigger the Select tool has selected, or null — `{kind, id}`,
     * see map-editor-trigger-select.js's file header for the id scheme.
     * Cleared whenever the tool changes away from 'select' (map-editor-input.js)
     * and restored by undo/redo like everything else in this draft.
     */
    selectedTriggerRef: null,
    /** Counter for `placed` entries that need a stable identity across
     * re-renders (triggers, so the Select tool can refer to one even after
     * others are added or removed) — see editNextPlacedUid. */
    placedSeq: 0,
  };
  return _edit;
}

/** A fresh, stable id for a new `placed` entry — see `_edit.placedSeq`. */
function editNextPlacedUid() {
  if (!_edit) return 0;
  _edit.placedSeq = (_edit.placedSeq || 0) + 1;
  return _edit.placedSeq;
}

function editActive() { return !!(_edit && _edit.on); }
function editDraft() { return _edit; }
function editKey(x, y) { return x + ',' + y; }

/**
 * Apply a list of `{x, y, index}` writes as one undoable step, optionally
 * batched with a list of `{x, y, id}` writes to the Special tab's overlay
 * (`specialCells`).
 *
 * An `index` of `null` **removes** the draft's write at that cell, so the
 * room's own tile shows through again — the same meaning `editRestore`
 * already gives null, which is what makes undo/redo of a removal symmetric
 * without a second mechanism. map-editor-stranded.js's "Remove tiles" is the
 * caller; painting never passes null.
 *
 * Batched rather than per-cell so a rectangle fill or a paste undoes in one
 * go, which is what makes "move the window back" a single keystroke — and
 * so that a single paint click carrying both a tile and a special (see
 * map-editor-special.js) undoes as one click too, not two.
 */
function editApply(writes, specialWrites) {
  if (!_edit) return 0;
  writes = writes || [];
  specialWrites = specialWrites || [];
  if (!writes.length && !specialWrites.length) return 0;
  var before = [];
  var changed = 0;
  for (var i = 0; i < writes.length; i++) {
    var w = writes[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.cells, k) ? _edit.cells[k] : null;
    if (was === w.index) continue;
    before.push({ x: w.x, y: w.y, index: was });
    if (w.index === null) delete _edit.cells[k];
    else _edit.cells[k] = w.index;
    changed += 1;
  }
  var specialBefore = [];
  for (var s = 0; s < specialWrites.length; s++) {
    var sw = specialWrites[s];
    var sk = editKey(sw.x, sw.y);
    var wasSpecial = Object.prototype.hasOwnProperty.call(_edit.specialCells, sk) ? _edit.specialCells[sk] : null;
    if (wasSpecial === sw.id) continue;
    specialBefore.push({ x: sw.x, y: sw.y, id: wasSpecial });
    if (sw.id === null) delete _edit.specialCells[sk];
    else _edit.specialCells[sk] = sw.id;
    changed += 1;
  }
  if (!changed) return 0;
  // The mark is how many attachments existed before this step, so undoing
  // a stamped gourd takes its object and its B-trigger with it.
  _edit.undo.push({ cells: before, special: specialBefore, placed: _edit.placed.length, dropped: [] });
  _edit.redo.length = 0;
  return changed;
}

/**
 * One undo step for a trigger-select operation (delete/move/paste) —
 * map-editor-trigger-select.js's only way to touch the shared undo stack.
 *
 * Unlike `editApply`'s cell-by-cell diff, a trigger op is recorded as a full
 * before/after snapshot of `{removedTriggers, placed}`: both arrays are tiny
 * (a room's own trigger count, plus whatever this draft added) so snapshotting
 * is cheap, and it sidesteps the tail-only indexing rule `editPruneAdded`
 * needs for the metatile dictionary — trigger identity is a `uid`, not a
 * position, so nothing here needs to be tail-only.
 *
 * Shares one stack with `editApply`'s steps (see docs/map-editor-redesign-plan.md
 * Phase 4): `editUndo`/`editRedo` branch on whether a step carries `.triggers`
 * rather than running a second, parallel undo mechanism.
 */
function editApplyTriggerOp(before, after) {
  if (!_edit) return;
  _edit.undo.push({ cells: [], special: [], placed: _edit.placed.length, dropped: [], triggers: { before: before, after: after } });
  _edit.redo.length = 0;
}

/** Deep-enough copy of a trigger snapshot's two arrays — see editApplyTriggerOp. */
function editCloneTriggerSnapshot(snap) {
  return {
    removedTriggers: snap.removedTriggers.map(function (r) { return { kind: r.kind, index: r.index }; }),
    placed: snap.placed.map(function (p) { return Object.assign({}, p); }),
  };
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

/** The `specialCells` counterpart to editRestore, where `id === null` clears. */
function editRestoreSpecial(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.specialCells, k) ? _edit.specialCells[k] : null;
    inverse.push({ x: w.x, y: w.y, id: was });
    if (w.id === null) delete _edit.specialCells[k];
    else _edit.specialCells[k] = w.id;
  }
  return inverse;
}

function editUndo(palette) {
  if (!_edit || !_edit.undo.length) return false;
  var step = _edit.undo.pop();
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  // A trigger-op step restores its own snapshot instead of the tail-splice
  // below — see editApplyTriggerOp. Both kinds of step still share one stack.
  var dropped;
  if (step.triggers) {
    var before = editCloneTriggerSnapshot(step.triggers.before);
    _edit.removedTriggers = before.removedTriggers;
    _edit.placed = before.placed;
    dropped = [];
  } else {
    dropped = _edit.placed.splice(step.placed);
  }
  _edit.redo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: dropped, triggers: step.triggers });
  editPruneAdded(palette);
  editDropStaleTriggerSelection();
  return true;
}

/**
 * Clear `selectedTriggerRef` if undo/redo just made it point at nothing.
 *
 * Undoing a paste (or redoing a delete) removes the very trigger that was
 * selected, and neither snapshot in `editApplyTriggerOp` touches
 * `selectedTriggerRef` itself — it is UI focus, not a property of the
 * trigger. Left alone, the Trigger tab would keep highlighting a row that no
 * longer exists. `editTriggerFind` lives in map-editor-trigger-select.js,
 * loaded after this file in the concatenated bundle; by the time a user
 * action can call `editUndo`/`editRedo` the whole bundle has already run, so
 * the function is always in reach here — see the `typeof` guard only for
 * the handful of standalone test bundles that load this file alone.
 */
function editDropStaleTriggerSelection() {
  if (_edit && _edit.selectedTriggerRef && typeof editTriggerFind === 'function'
    && !editTriggerFind(_edit.selectedTriggerRef)) {
    _edit.selectedTriggerRef = null;
  }
}

function editRedo(palette) {
  if (!_edit || !_edit.redo.length) return false;
  var step = _edit.redo.pop();
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  if (step.triggers) {
    var after = editCloneTriggerSnapshot(step.triggers.after);
    _edit.removedTriggers = after.removedTriggers;
    _edit.placed = after.placed;
  } else {
    for (var i = 0; i < step.dropped.length; i++) _edit.placed.push(step.dropped[i]);
  }
  _edit.undo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: [], triggers: step.triggers });
  editPruneAdded(palette);
  editDropStaleTriggerSelection();
  return true;
}

/**
 * Drop metatiles the draft no longer needs.
 *
 * Undoing the cells that used a composed stamp has to undo the stamp too,
 * or the dictionary keeps growing with entries nothing references and the
 * budget lies. Only the **tail** is dropped: an index is a position, so
 * removing from the middle would silently repoint every cell above it.
 *
 * The current brush is kept even when unplaced — you armed it on purpose,
 * and it is one entry.
 */
function editPruneAdded(palette) {
  if (!_edit) return;
  var base = palette ? palette.count : 0;
  var used = {};
  Object.keys(_edit.cells).forEach(function (k) { used[_edit.cells[k]] = true; });
  while (_edit.added.length) {
    var index = base + _edit.added.length - 1;
    if (used[index] || _edit.brush === index) break;
    _edit.added.pop();
  }
  if (_edit.brush >= base + _edit.added.length) _edit.brush = -1;
  editPruneGraphics(palette);
}

/**
 * Drop adopted graphics no surviving stamp names.
 *
 * Same tail-only rule, and for the same reason: a graphic's slot is its
 * position in the list, so the words already written would point at the
 * wrong picture if one were removed from the middle.
 */
function editPruneGraphics(palette) {
  if (!_edit || !palette || !palette.tiles) return;
  var base = palette.tiles.count;
  var highest = -1;
  for (var i = 0; i < _edit.added.length; i++) {
    var a = _edit.added[i];
    for (var j = 0; j < 2; j++) {
      var chr = (j ? a.layer2 : a.layer1) & 0x3ff;
      var slot = Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2);
      if (slot >= base && slot - base > highest) highest = slot - base;
    }
  }
  _edit.addedGraphics.length = highest + 1;
}

/**
 * The draft as the shape `rebuild_model` wants.
 *
 * Cell writes are grid coordinates and metatile **ids**, because that is
 * what `layer1_metatile_ids` holds; composed stamps are appended to the
 * Block 3 slices in order. Nothing here applies it — this is the handover
 * format, and the write itself needs a confirmation the extension does not
 * have yet.
 *
 * `specialCells` is deliberately absent. A gate or drift pick already made
 * its real effect here — it modified the cell's stamp, which is exactly
 * what `cells`/`appendMetatiles` already carry — so `specialCells` itself
 * is only the glyph overlay, never a second source of truth for it.
 * Stairs and entrance carry no ROM effect at all (see map-editor-special.js
 * and docs/map-editor-redesign-plan.md §5.1): entrance is a room-metadata
 * placement helper with no confirmed encoder field to write into, and
 * stairs has no attested collision encoding. Both stay visual-only until
 * one of those is confirmed.
 *
 * `removedTriggers` is the Select tool's counterpart to `attachments`: a
 * base trigger this draft hid (deleted, or moved — a move hides the base one
 * and adds a new `attachments` entry for the moved position). Soft-deleted
 * `placed` entries (`removed: true`, from deleting a placed trigger — see
 * map-editor-trigger-select.js) are dropped here rather than exported as
 * attachments nobody asked for.
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
    // Graphics Block 1 has to gain for the words above to resolve, and the
    // objects and triggers the stamped constructs need to actually work.
    appendGraphics: _edit.addedGraphics.slice(),
    // The draft's own copy, not `editFamilies()`: this file owns `_edit` and
    // reaching into the families panel from here would invert that.
    families: (_edit.families || []).slice(),
    attachments: _edit.placed.filter(function (p) { return !p.removed; }),
    removedTriggers: (_edit.removedTriggers || []).slice(),
  };
}
