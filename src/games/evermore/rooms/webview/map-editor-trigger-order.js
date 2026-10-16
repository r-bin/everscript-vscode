// Ownership: the order of the Trigger tab's lists, and dragging rows to
// change it — within a list, or onto the other kind's sub-tab to turn a
// B-trigger into a step trigger or back (the design mock's "drag-to-reorder
// within/between lists").
//
// The order is `_edit.triggerOrder` (`{b: [id...], step: [id...]}`, ids as in
// map-editor-trigger-select.js), null until a row is first dragged: the
// room's own order. A trigger missing from it (added later) goes after the
// ordered ones, in the room's order. It is part of the trigger snapshot, so
// a reorder is one undo step, and it is saved with a custom map.
//
// What the order means in the game is not attested: vanilla's trigger
// tables are scanned in order, but no room is known to depend on it. The
// row's `#n` is its place in this list — the order an export would write.
//
// Owns: _triggerDragRow (the row being dragged, as "<kind>:<id>").

var _triggerDragRow = null;

/** `list` (one kind's triggers) in the tab's order. */
function triggerOrdered(kind, list) {
  var d = editDraft();
  var ids = d && d.triggerOrder && d.triggerOrder[kind];
  if (!ids || !ids.length) return list;
  var at = {};
  ids.forEach(function (id, i) { at[id] = i; });
  return list.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
    var x = at[a.t.ref.id] !== undefined ? at[a.t.ref.id] : ids.length + a.i;
    var y = at[b.t.ref.id] !== undefined ? at[b.t.ref.id] : ids.length + b.i;
    return x - y;
  }).map(function (e) { return e.t; });
}

/** A trigger got a new id (a room trigger moved becomes a placed one): keep its place. */
function triggerOrderRename(kind, from, to) {
  var d = editDraft();
  var ids = d && d.triggerOrder && d.triggerOrder[kind];
  if (!ids) return;
  var i = ids.indexOf(from);
  if (i >= 0) ids[i] = to;
}

/** The ids of one kind, in the current order, with `id` left out. */
function triggerIdsWithout(kind, id) {
  return editTriggerList(kind).map(function (t) { return t.ref.id; }).filter(function (x) { return x !== id; });
}

function triggerIdsInsert(ids, id, beforeId) {
  var i = beforeId ? ids.indexOf(beforeId) : -1;
  if (i < 0) ids.push(id); else ids.splice(i, 0, id);
  return ids;
}

/**
 * Move the row `ref` to just before `beforeRef` in list `toKind` (the end
 * when `beforeRef` is null). Another kind converts it: a placed trigger
 * changes kind; a room trigger is removed and placed again as the other kind
 * (the same way moving one does). One undo step. Returns the new ref.
 */
function triggerReorder(ref, toKind, beforeRef) {
  var d = editDraft();
  var t = editTriggerFind(ref);
  if (!d || !t || !triggerDataKind(toKind)) return null;
  if (editLocked()) { editNote('this map is locked — unlock it to reorder its triggers'); renderEditChrome(); return null; }
  var beforeId = beforeRef && beforeRef.kind === toKind && beforeRef.id !== ref.id ? beforeRef.id : null;
  var before = triggerSnapshot();
  var order = Object.assign({}, d.triggerOrder || {});
  var newRef = { kind: toKind, id: ref.id };
  if (toKind !== ref.kind) {
    order[ref.kind] = triggerIdsWithout(ref.kind, ref.id);
    if (t.origin === 'base') {
      d.removedTriggers.push({ kind: ref.kind, index: t.index });
      var uid = editNextPlacedUid();
      d.placed.push({ kind: triggerDataKind(toKind), x: t.x1, y: t.y1, w: t.x2 - t.x1 + 1, h: t.y2 - t.y1 + 1,
        scriptId: t.scriptId, uid: uid });
      newRef.id = 'placed:' + uid;
    } else {
      d.placed.forEach(function (p) { if (p.uid === t.uid) p.kind = triggerDataKind(toKind); });
    }
  }
  order[toKind] = triggerIdsInsert(triggerIdsWithout(toKind, newRef.id), newRef.id, beforeId);
  d.triggerOrder = order;
  var after = triggerSnapshot();
  if (JSON.stringify(after) === JSON.stringify(before)) return ref;
  editApplyTriggerOp(before, after);
  editNote(toKind !== ref.kind
    ? 'now a ' + (toKind === 'b' ? 'B-trigger' : 'step trigger') + ' — it keeps its box and script'
    : 'trigger moved to #' + order[toKind].indexOf(newRef.id));
  triggerSelect(newRef);
  return newRef;
}

// ── dragging rows (HTML5 drag and drop, bound once on the document) ──────

function triggerDropTarget(el) {
  var row = el && el.closest ? el.closest('.rg-trigger-row[data-trigger-ref]') : null;
  if (row) return { kind: triggerParseRef(row.getAttribute('data-trigger-ref')).kind, row: row };
  var tab = el && el.closest ? el.closest('.rg-trigger-kind[data-trigger-kind]') : null;
  if (tab) return { kind: tab.getAttribute('data-trigger-kind'), tab: tab };
  var list = el && el.closest ? el.closest('.rg-trigger-list[data-trigger-list]') : null;
  if (list) return { kind: list.getAttribute('data-trigger-list'), list: list };
  return null;
}

function triggerDropClear() {
  var marks = document.querySelectorAll('.rg-drop-before, .rg-drop-on');
  for (var i = 0; i < marks.length; i++) marks[i].classList.remove('rg-drop-before', 'rg-drop-on');
}

function setupTriggerRowDrag() {
  if (typeof document === 'undefined' || document._rgTriggerDrag) return;
  document._rgTriggerDrag = true;
  document.addEventListener('dragstart', function (e) {
    var row = e.target && e.target.closest ? e.target.closest('.rg-trigger-row[data-trigger-ref]') : null;
    if (!row) return;
    _triggerDragRow = row.getAttribute('data-trigger-ref');
    row.classList.add('rg-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', _triggerDragRow); }
  });
  document.addEventListener('dragover', function (e) {
    if (!_triggerDragRow) return;
    var at = triggerDropTarget(e.target);
    if (!at) return;
    e.preventDefault();
    triggerDropClear();
    if (at.row) at.row.classList.add('rg-drop-before');
    else (at.tab || at.list).classList.add('rg-drop-on');
  });
  document.addEventListener('drop', function (e) {
    if (!_triggerDragRow) return;
    var at = triggerDropTarget(e.target);
    var ref = triggerParseRef(_triggerDragRow);
    _triggerDragRow = null;
    triggerDropClear();
    if (!at || !ref) return;
    e.preventDefault();
    triggerReorder(ref, at.kind, at.row ? triggerParseRef(at.row.getAttribute('data-trigger-ref')) : null);
  });
  document.addEventListener('dragend', function () {
    _triggerDragRow = null;
    triggerDropClear();
    var rows = document.querySelectorAll('.rg-dragging');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('rg-dragging');
  });
}

setupTriggerRowDrag();
