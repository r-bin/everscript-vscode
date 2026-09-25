// Ownership: unifying the room's own ROM-sourced triggers
// (`_mtPalette.attachments.bTrigger`/`.stepOn`, tuples `[x1,y1,x2,y2,scriptId]`)
// with this draft's own additions (`_edit.placed`, `{kind,x,y,w,h,scriptId,uid}`)
// into one selectable, movable, deletable, copy/pasteable "trigger" concept
// for the Select tool (map-editor-gestures.js) and the Trigger tab
// (map-editor-trigger-panel.js).
//
// Neither source array's own shape changes — this file only reads them and
// writes through `_edit.removedTriggers` / `_edit.placed` /
// `_edit.selectedTriggerRef`, the same way map-editor-special.js reads and
// writes `_edit.currentSpecialId` without owning `_edit` itself (map-editor.js
// does). See docs/map-editor-redesign-plan.md Phase 4 and STATE_FLOW.md.
//
// A trigger ref is `{kind: 'step'|'b', id}`. `id` is `'base:' + i`, `i`
// being the index into that kind's `_mtPalette.attachments` array (stable
// for the room's lifetime — that array is never reordered), or
// `'placed:' + uid`, `uid` being the stable identity `editNextPlacedUid()`
// gave a `_edit.placed` entry when it was created (by a paste, a base-trigger
// move, or a stamped construct — see map-editor-constructs.js).
//
// Owns: the drag-in-progress shape `_triggerDrag` (module-local, not on
// `_edit`: an in-progress drag is not part of the undo history until it
// commits — same reasoning as `_editDrag` in map-editor-gestures.js) and
// `_triggerClipboard` (an instance field, not reactive state, per the design
// mock's own note — never touched by undo/redo).

var TRIGGER_DATA_KIND = { step: 'stepOn', b: 'bTrigger' };

/** `{ref, w, h, x, y, grabDx, grabDy}` while a trigger drag is in progress. */
var _triggerDrag = null;
/** `{kind, x1, y1, w, h, scriptId}` — the last copied trigger, or null. */
var _triggerClipboard = null;

function triggerDataKind(kind) { return TRIGGER_DATA_KIND[kind] || null; }

/** `s` is `"<kind>:<id>"`; `id` itself may contain further colons. */
function triggerParseRef(s) {
  var i = s.indexOf(':');
  if (i < 0) return null;
  return { kind: s.slice(0, i), id: s.slice(i + 1) };
}

function triggerRefsEqual(a, b) {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

function triggerBaseRemoved(kind, index) {
  var d = editDraft();
  var list = d && d.removedTriggers;
  if (!list) return false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === kind && list[i].index === index) return true;
  }
  return false;
}

/**
 * Every trigger of one kind, base and placed, as one list of boxes.
 *
 * `x1,y1,x2,y2` are inclusive metatile cells, matching both source shapes
 * (an attachments tuple already is that; a placed `{x,y,w,h}` is converted).
 */
function editTriggerList(kind) {
  var out = [];
  var d = editDraft();
  if (!d) return out;
  var dataKind = triggerDataKind(kind);
  var base = (_mtPalette && _mtPalette.attachments && _mtPalette.attachments[dataKind]) || [];
  for (var i = 0; i < base.length; i++) {
    if (triggerBaseRemoved(kind, i)) continue;
    var t = base[i];
    out.push({
      ref: { kind: kind, id: 'base:' + i }, origin: 'base', index: i,
      x1: t[0], y1: t[1], x2: t[2], y2: t[3], scriptId: t[4],
    });
  }
  (d.placed || []).forEach(function (p) {
    if (p.kind !== dataKind || p.uid == null || p.removed) return;
    out.push({
      ref: { kind: kind, id: 'placed:' + p.uid }, origin: 'placed', uid: p.uid,
      x1: p.x, y1: p.y, x2: p.x + p.w - 1, y2: p.y + p.h - 1, scriptId: p.scriptId,
    });
  });
  return out;
}

/** The box+origin for a ref, or null if it no longer exists. */
function editTriggerFind(ref) {
  if (!ref) return null;
  var list = editTriggerList(ref.kind);
  for (var i = 0; i < list.length; i++) {
    if (list[i].ref.id === ref.id) return list[i];
  }
  return null;
}

/**
 * The trigger at this cell, or null. Step triggers are tested before B
 * triggers (the Trigger tab's own section order); a cell inside more than
 * one box picks the smallest one, since vanilla nests small triggers (a
 * doorway) inside larger ones (a room-wide cutscene zone) far more often
 * than the reverse.
 */
function editTriggerAt(x, y) {
  var hits = [];
  ['step', 'b'].forEach(function (kind) {
    editTriggerList(kind).forEach(function (t) {
      if (x >= t.x1 && x <= t.x2 && y >= t.y1 && y <= t.y2) hits.push(t);
    });
  });
  if (!hits.length) return null;
  hits.sort(function (a, b) {
    return (a.x2 - a.x1 + 1) * (a.y2 - a.y1 + 1) - (b.x2 - b.x1 + 1) * (b.y2 - b.y1 + 1);
  });
  return hits[0].ref;
}

/** Select a trigger (or clear with null); switches the dock to the Trigger tab. */
function triggerSelect(ref) {
  var d = editDraft();
  if (!d) return;
  d.selectedTriggerRef = ref;
  _triggerDrag = null;
  if (ref && typeof _editActiveTab !== 'undefined') _editActiveTab = 'trigger';
  // Its kind's sub-tab, or its row would not be listed (map-editor-trigger-panel.js).
  if (ref && typeof _editTriggerKind !== 'undefined') _editTriggerKind = ref.kind;
  if (typeof renderEditChrome === 'function') renderEditChrome();
}

/** A plain-data copy of the two arrays a trigger op can change. */
function triggerSnapshot() {
  var d = editDraft();
  return {
    removedTriggers: (d.removedTriggers || []).map(function (r) { return { kind: r.kind, index: r.index }; }),
    placed: (d.placed || []).map(function (p) { return Object.assign({}, p); }),
  };
}

/** Clamp a trigger's would-be top-left so its whole box stays on the grid. */
function triggerClamp(x, y, w, h) {
  var maxX = (_mtPalette ? _mtPalette.widthTiles : w) - w;
  var maxY = (_mtPalette ? _mtPalette.heightTiles : h) - h;
  return { x: Math.max(0, Math.min(Math.max(0, maxX), x)), y: Math.max(0, Math.min(Math.max(0, maxY), y)) };
}

/**
 * Delete the selected trigger.
 *
 * A base trigger is marked removed, never mutated — it isn't this draft's to
 * rewrite (see `_edit.removedTriggers`'s doc comment in map-editor.js). A
 * placed trigger is soft-deleted (`removed: true`) rather than spliced, so
 * `_edit.placed`'s length stays append-only outside of the pre-existing
 * tail-prune-on-undo path a stamped construct's cell paint already relies on.
 */
function triggerDeleteSelected() {
  var d = editDraft();
  if (!d || !d.selectedTriggerRef) return;
  var t = editTriggerFind(d.selectedTriggerRef);
  if (!t) { d.selectedTriggerRef = null; return; }
  var before = triggerSnapshot();
  if (t.origin === 'base') {
    d.removedTriggers.push({ kind: t.ref.kind, index: t.index });
  } else {
    var item = d.placed.filter(function (p) { return p.uid === t.uid; })[0];
    if (item) item.removed = true;
  }
  editApplyTriggerOp(before, triggerSnapshot());
  d.selectedTriggerRef = null;
  if (typeof editNote === 'function') editNote((t.ref.kind === 'b' ? 'B-trigger' : 'step trigger') + ' deleted');
  if (typeof renderEditChrome === 'function') renderEditChrome();
}

/**
 * Move a trigger so its top-left lands at `(x, y)`, clamped to the grid.
 *
 * Moving a base trigger hides it (like delete) and adds a new `placed` entry
 * at the new position — the suggested design in
 * docs/map-editor-redesign-plan.md Phase 4: reuse the addition mechanism
 * that already flows into `editExport()` rather than inventing a way to
 * rewrite a base trigger in place. Moving an already-placed trigger just
 * mutates its `x`/`y`.
 */
function triggerCommitMove(ref, x, y) {
  var d = editDraft();
  var t = editTriggerFind(ref);
  if (!d || !t) return;
  var w = t.x2 - t.x1 + 1;
  var h = t.y2 - t.y1 + 1;
  var at = triggerClamp(x, y, w, h);
  if (at.x === t.x1 && at.y === t.y1) return; // no real move — nothing to undo
  var before = triggerSnapshot();
  var newRef = ref;
  if (t.origin === 'base') {
    d.removedTriggers.push({ kind: ref.kind, index: t.index });
    var uid = editNextPlacedUid();
    d.placed.push({ kind: triggerDataKind(ref.kind), x: at.x, y: at.y, w: w, h: h, scriptId: t.scriptId, uid: uid });
    newRef = { kind: ref.kind, id: 'placed:' + uid };
  } else {
    var item = d.placed.filter(function (p) { return p.uid === t.uid; })[0];
    if (item) { item.x = at.x; item.y = at.y; }
  }
  editApplyTriggerOp(before, triggerSnapshot());
  d.selectedTriggerRef = newRef;
}

/** Start a drag if `cell` lands inside the currently selected trigger. */
function triggerDragStart(cell) {
  var d = editDraft();
  if (!d || !d.selectedTriggerRef) return false;
  var t = editTriggerFind(d.selectedTriggerRef);
  if (!t || cell.x < t.x1 || cell.x > t.x2 || cell.y < t.y1 || cell.y > t.y2) return false;
  _triggerDrag = {
    ref: d.selectedTriggerRef,
    w: t.x2 - t.x1 + 1, h: t.y2 - t.y1 + 1,
    grabDx: cell.x - t.x1, grabDy: cell.y - t.y1,
    x: t.x1, y: t.y1,
  };
  return true;
}

/** Live preview: follow the pointer, clamped, while the drag is held. */
function triggerDragMove(cell) {
  if (!_triggerDrag) return;
  var at = triggerClamp(cell.x - _triggerDrag.grabDx, cell.y - _triggerDrag.grabDy, _triggerDrag.w, _triggerDrag.h);
  _triggerDrag.x = at.x;
  _triggerDrag.y = at.y;
  if (typeof renderEditLayer === 'function') renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** Commit the drag in progress, if any. */
function triggerDragCommit() {
  if (!_triggerDrag) return;
  var drag = _triggerDrag;
  _triggerDrag = null;
  triggerCommitMove(drag.ref, drag.x, drag.y);
  if (typeof renderEditChrome === 'function') renderEditChrome();
}

/** Copy the selected trigger to the (non-undoable) clipboard field. */
function triggerCopySelected() {
  var d = editDraft();
  if (!d || !d.selectedTriggerRef) return;
  var t = editTriggerFind(d.selectedTriggerRef);
  if (!t) return;
  if (typeof _regionClip !== 'undefined') _regionClip = null; // the last copy is what pastes
  _triggerClipboard = {
    kind: t.ref.kind, x1: t.x1, y1: t.y1,
    w: t.x2 - t.x1 + 1, h: t.y2 - t.y1 + 1, scriptId: t.scriptId,
  };
  if (typeof editNote === 'function') editNote((t.ref.kind === 'b' ? 'B-trigger' : 'step trigger') + ' copied');
}

/** Paste a new trigger offset by +1 row/+1 col from the copied one, and select it. */
function triggerPasteClipboard() {
  var d = editDraft();
  var c = _triggerClipboard;
  if (!d || !c) return;
  var at = triggerClamp(c.x1 + 1, c.y1 + 1, c.w, c.h);
  var before = triggerSnapshot();
  var uid = editNextPlacedUid();
  d.placed.push({ kind: triggerDataKind(c.kind), x: at.x, y: at.y, w: c.w, h: c.h, scriptId: c.scriptId, uid: uid });
  editApplyTriggerOp(before, triggerSnapshot());
  triggerSelect({ kind: c.kind, id: 'placed:' + uid });
}

/**
 * Clear `selectedTriggerRef` if undo/redo just made it point at nothing.
 *
 * Undoing a paste (or redoing a delete) removes the very trigger that was
 * selected, and neither snapshot in `editApplyTriggerOp` touches
 * `selectedTriggerRef` itself — it is UI focus, not a property of the
 * trigger. Left alone, the Trigger tab would keep highlighting a row that no
 * longer exists. Called by map-editor.js's `editUndo`/`editRedo`
 * (through a `typeof` guard, for the standalone test bundles that load that
 * file without this one); lives here because selection is this file's.
 */
function editDropStaleTriggerSelection() {
  if (_edit && _edit.selectedTriggerRef && typeof editTriggerFind === 'function'
    && !editTriggerFind(_edit.selectedTriggerRef)) {
    _edit.selectedTriggerRef = null;
  }
}
