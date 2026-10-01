// Ownership: the map editor's **state** — what has been drawn, what has
// been composed, and the undo stack. No DOM, no markup: map-editor-ui.js
// draws it and map-editor-paint.js drives it.
//
// Nothing here writes to the ROM. An edit lives in this draft until it is
// exported (docs/map-format/map_editor_ui.md §6). A step's family slots and
// resize are map-editor-history.js's. Owns: _edit; only this file assigns it.

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
    cut: {},          // the cuttable layer over it, same shape — map-editor-cutlayer.js
    added: [],        // {layer1, layer2, collision}
    undo: [],
    redo: [],
    tool: 'paint',    // select | paint | erase | pick | copy | move | stamp
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
     * Where the Boy starts on a drafted map, `{x, y}` in metatiles, or null
     * on a ROM room (whose arrivals are its doors). Exactly one, always on
     * the map: map-editor-start.js places it when the blank room arrives,
     * editMoveStart is the only way to move it, and nothing removes it —
     * the "debug entrance" a level editor needs to test from.
     */
    start: null,
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
    /** `{b: [id...], step: [id...]}`: the Trigger tab's order, or null for the room's own (map-editor-trigger-order.js). */
    triggerOrder: null,
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
    /** Stamped constructs and widgets, each one movable thing — map-editor-groups.js. */
    groups: [],
    groupSeq: 0,
    /** The level (elevation plane, 0..3) new tiles are drawn on — map-editor-levels.js. */
    plane: 1,
    /** Header fields this draft sets over the room's (the Info tab, map-editor-info.js), or null. */
    header: null,
    /** The open compound step, or null — see editBegin. Never saved. */
    txn: null,
  };
  return _edit;
}

/**
 * Start a compound step: every write until editEnd is one undo step — a
 * pencil drag across twenty cells, a group move (lift + place + its
 * triggers). Writes merge into it, keeping the *first* value each cell had,
 * so undo puts back what was there before the gesture began.
 */
function editBegin() {
  if (!_edit) return;
  if (_edit.txn) editEnd();
  _edit.txn = { step: null, seen: {}, seenSpecial: {}, snap: editTxnSnapshot() };
}

/** Close the compound step: triggers, objects and groups as before/after snapshots, restored wholesale on undo.
 *  A group changes what the map shows without an editApply, so the cells-changed hooks run here for it. */
function editEnd() {
  var t = _edit && _edit.txn;
  if (!t) return;
  _edit.txn = null;
  var now = editTxnSnapshot();
  if (now === t.snap) return;
  var a = JSON.parse(t.snap);
  var b = JSON.parse(now);
  if (JSON.stringify(a.g) !== JSON.stringify(b.g)) { editCellsChanged(); b = JSON.parse(editTxnSnapshot()); }
  var step = t.step || editTxnStep(t);
  step.triggers = { before: { removedTriggers: a.r, placed: a.p, triggerOrder: a.o },
    after: { removedTriggers: b.r, placed: b.p, triggerOrder: b.o } };
  step.groups = { before: a.g, after: b.g }; step.header = { before: a.h, after: b.h };
  if (typeof editStepExtras === 'function') editStepExtras(step, a, b); // family slots (map-editor-history.js)
}

function editTxnSnapshot() {
  return JSON.stringify({ r: _edit.removedTriggers || [], p: _edit.placed || [], g: _edit.groups || [],
    o: _edit.triggerOrder || null, h: _edit.header || null, f: typeof editFamiliesSnapshot === 'function' ? editFamiliesSnapshot() : null });
}

/** The open compound step, pushed on first use. */
function editTxnStep(t) {
  if (!t.step) {
    t.step = { cells: [], special: [], placed: _edit.placed.length, dropped: [] };
    _edit.undo.push(t.step);
    _edit.redo.length = 0;
  }
  return t.step;
}

/** A fresh, stable id for a new `placed` entry — see `_edit.placedSeq`. */
function editNextPlacedUid() {
  if (!_edit) return 0;
  _edit.placedSeq = (_edit.placedSeq || 0) + 1;
  return _edit.placedSeq;
}

function editActive() { return !!(_edit && _edit.on); }
function editLocked() { return !!(_edit && _edit.locked); } // the bar's `locked`: nothing may change (map-editor-input.js)
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
    var into = editLayerMap(w);
    var was = Object.prototype.hasOwnProperty.call(into, k) ? into[k] : null;
    if (was === w.index) continue;
    before.push(editStampRef(w.x, w.y, was, w.layer));
    if (w.index === null) delete into[k];
    else into[k] = w.index;
    changed += 1;
  }
  var specialBefore = [];
  for (var s = 0; s < specialWrites.length; s++) {
    var sw = specialWrites[s];
    var sk = editKey(sw.x, sw.y);
    var wasSpecial = Object.prototype.hasOwnProperty.call(_edit.specialCells, sk) ? _edit.specialCells[sk] : null;
    var nextVal = typeof editMergeSpecial === 'function' ? editMergeSpecial(wasSpecial, sw.id) : sw.id;
    if (JSON.stringify(nextVal) === JSON.stringify(wasSpecial)) continue;
    specialBefore.push({ x: sw.x, y: sw.y, id: wasSpecial });
    if (nextVal === null) delete _edit.specialCells[sk];
    else _edit.specialCells[sk] = nextVal;
    changed += 1;
  }
  if (!changed) return 0;
  if (_edit.txn) {
    // Inside a gesture: fold into its one step, first value per cell wins.
    var step = editTxnStep(_edit.txn);
    before.forEach(function (b) {
      var id = (b.layer || '') + ':' + b.x + ',' + b.y;
      if (!_edit.txn.seen[id]) { _edit.txn.seen[id] = true; step.cells.push(b); }
    });
    specialBefore.forEach(function (b) {
      var id = b.x + ',' + b.y;
      if (!_edit.txn.seenSpecial[id]) { _edit.txn.seenSpecial[id] = true; step.special.push(b); }
    });
    editCellsChanged();
    return changed;
  }
  // The mark is how many attachments existed before this step, so undoing
  // a stamped gourd takes its object and its B-trigger with it.
  _edit.undo.push({ cells: before, special: specialBefore, placed: _edit.placed.length, dropped: [] });
  _edit.redo.length = 0;
  editCellsChanged();
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
  if (_edit.txn) return; // the compound step snapshots triggers itself
  _edit.undo.push({ cells: [], special: [], placed: _edit.placed.length, dropped: [], triggers: { before: before, after: after } });
  _edit.redo.length = 0;
}

/**
 * Move the Boy's start marker, as one undoable step on the shared stack.
 *
 * Its own step kind (`start`), like a trigger op: it is not a cell and not a
 * special — a special is one per cell and would overwrite (or be overwritten
 * by) a gate or drift glyph there, and erase clears specials. The start
 * survives both by not being one.
 */
function editMoveStart(x, y) {
  if (!_edit || !_edit.start) return false;
  if (_edit.start.x === x && _edit.start.y === y) return false;
  if (_edit.txn) {
    // A drag of the Boy is one step: remember only where he started.
    var st = editTxnStep(_edit.txn);
    if (!st.start) st.start = { x: _edit.start.x, y: _edit.start.y };
  } else {
    _edit.undo.push({ cells: [], special: [], placed: _edit.placed.length, dropped: [],
      start: { x: _edit.start.x, y: _edit.start.y } });
    _edit.redo.length = 0;
  }
  _edit.start = { x: x, y: y };
  return true;
}

/** The map a write lands in: the cuttable layer for `layer: 'cut'`, else the cells. */
function editLayerMap(w) {
  if (w.layer === 'coll' || w.layer === 'collDraw') return _edit[w.layer] || (_edit[w.layer] = {}); // map-editor-collision-tab.js
  if (w.layer !== 'cut') return _edit.cells;
  return _edit.cut || (_edit.cut = {});
}

/** Swap a step's saved start with the current one; returns the inverse. */
function editRestoreStart(step) {
  if (!step.start || !_edit.start) return undefined;
  var was = { x: _edit.start.x, y: _edit.start.y };
  _edit.start = { x: step.start.x, y: step.start.y };
  return was;
}

/** Deep-enough copy of a trigger snapshot's two arrays — see editApplyTriggerOp. */
function editCloneTriggerSnapshot(snap) {
  return {
    removedTriggers: snap.removedTriggers.map(function (r) { return { kind: r.kind, index: r.index }; }),
    placed: snap.placed.map(function (p) { return Object.assign({}, p); }),
    // Absent in steps saved before the order existed: those leave it alone.
    triggerOrder: 'triggerOrder' in snap ? JSON.parse(JSON.stringify(snap.triggerOrder || null)) : undefined,
  };
}

/** Put a batch of `{x, y, index}` back, where `index === null` clears. */
function editRestore(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var into = editLayerMap(w);
    var was = Object.prototype.hasOwnProperty.call(into, k) ? into[k] : null;
    inverse.push(editStampRef(w.x, w.y, was, w.layer));
    var to = editStampResolve(w.index, w.words);
    if (to === null) delete into[k];
    else into[k] = to;
  }
  return inverse;
}

// editStampRef / editStampResolve (history entries that can bring their
// stamp back) are in map-editor-stamps.js.

/** The `specialCells` counterpart to editRestore, where `id === null` clears. */
function editRestoreSpecial(batch) {
  var inverse = [];
  for (var i = 0; i < batch.length; i++) {
    var w = batch[i];
    var k = editKey(w.x, w.y);
    var was = Object.prototype.hasOwnProperty.call(_edit.specialCells, k) ? _edit.specialCells[k] : null;
    inverse.push({ x: w.x, y: w.y, id: was });
    if (w.id === null) delete _edit.specialCells[k];
    else _edit.specialCells[k] = Array.isArray(w.id) ? w.id.slice() : w.id;
  }
  return inverse;
}

function editUndo(palette) {
  if (_edit && _edit.txn) editEnd();
  if (!_edit || !_edit.undo.length) return false;
  var step = _edit.undo.pop();
  if (step.groups) _edit.groups = JSON.parse(JSON.stringify(step.groups.before));
  if (step.header) editRestoreHeader(step.header.before);
  if (typeof editRestoreExtras === 'function') editRestoreExtras(step, 'before');
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  // A trigger-op step restores its own snapshot instead of the tail-splice
  // below — see editApplyTriggerOp. Both kinds of step still share one stack.
  var dropped;
  if (step.triggers) {
    var before = editCloneTriggerSnapshot(step.triggers.before);
    _edit.removedTriggers = before.removedTriggers;
    _edit.placed = before.placed;
    if (before.triggerOrder !== undefined) _edit.triggerOrder = before.triggerOrder;
    dropped = [];
  } else {
    dropped = _edit.placed.splice(step.placed);
  }
  _edit.redo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: dropped, triggers: step.triggers,
    groups: step.groups, header: step.header, families: step.families, resize: step.resize, start: editRestoreStart(step) });
  editPruneAdded(palette);
  if (typeof editDropStaleTriggerSelection === 'function') editDropStaleTriggerSelection();
  editCellsChanged();
  return true;
}

/** Families that came in by painting follow the cells (map-editor-families.js),
 *  and a drafted map's collision layer is redrawn (map-editor-collision.js). */
function editCellsChanged() {
  if (typeof editSyncPaintedFamilies === 'function') editSyncPaintedFamilies();
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();
}

function editRedo(palette) {
  if (_edit && _edit.txn) editEnd();
  if (!_edit || !_edit.redo.length) return false;
  var step = _edit.redo.pop();
  if (step.groups) _edit.groups = JSON.parse(JSON.stringify(step.groups.after));
  if (step.header) editRestoreHeader(step.header.after);
  if (typeof editRestoreExtras === 'function') editRestoreExtras(step, 'after');
  var inverse = editRestore(step.cells);
  var specialInverse = editRestoreSpecial(step.special || []);
  if (step.triggers) {
    var after = editCloneTriggerSnapshot(step.triggers.after);
    _edit.removedTriggers = after.removedTriggers;
    _edit.placed = after.placed;
    if (after.triggerOrder !== undefined) _edit.triggerOrder = after.triggerOrder;
  } else {
    for (var i = 0; i < step.dropped.length; i++) _edit.placed.push(step.dropped[i]);
  }
  _edit.undo.push({ cells: inverse, special: specialInverse, placed: step.placed, dropped: [], triggers: step.triggers,
    groups: step.groups, header: step.header, families: step.families, resize: step.resize, start: editRestoreStart(step) });
  editPruneAdded(palette);
  if (typeof editDropStaleTriggerSelection === 'function') editDropStaleTriggerSelection();
  editCellsChanged();
  return true;
}
