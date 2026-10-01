// Ownership: the parts of an undo step that are not cells, specials,
// triggers, groups, the header or the Boy (those are map-editor.js's) —
// the seven family slots, and the canvas size a resize sets.
//
// Both are on the one history (map-editor-rules §6): pressing undo means
// "the last thing I did", and freeing a family slot or dragging the resize
// grip is a thing you did. A rename is not: a map's or widget's name is not
// part of the drawing, and stays off the history.
//
// A step carries `families: {before, after}` when a gesture changed the
// slots (editStepExtras, from editEnd's snapshots), and `resize: {before,
// after}` ({w, h}) when it changed the size (editResizeStep). Each is
// applied by editRestoreExtras in the direction asked for.
//
// Owns: nothing — the state is the draft's.

/** The family slots as one JSON-safe value: a hole is `null` here, `undefined` in the draft. */
function editFamiliesSnapshot() {
  var d = editDraft();
  if (!d) return null;
  return {
    slots: (d.families || []).map(function (f) { return f === undefined ? null : f; }),
    dropped: Object.assign({}, d.droppedFamilies || {}),
    auto: Object.assign({}, d.autoFamilies || {}),
  };
}

/** Put the slots back as a snapshot has them. */
function editFamiliesRestore(snap) {
  var d = editDraft();
  if (!d || !snap) return;
  d.families = snap.slots.map(function (f) { return f === null ? undefined : f; });
  d.droppedFamilies = Object.assign({}, snap.dropped);
  d.autoFamilies = Object.assign({}, snap.auto);
  d.families.forEach(function (f) { if (f !== undefined && typeof ensureFamilySheet === 'function') ensureFamilySheet(f); });
}

/** editEnd: keep the slots on the step when the gesture changed them. */
function editStepExtras(step, a, b) {
  if (JSON.stringify(a.f) !== JSON.stringify(b.f)) step.families = { before: a.f, after: b.f };
}

/** One undo step for a resize the grip committed (map-editor-newroom.js resizeEnd). */
function editResizeStep(before, after) {
  var d = editDraft();
  if (!d) return;
  d.undo.push({ cells: [], special: [], placed: d.placed.length, dropped: [],
    resize: { before: before, after: after },
    // A shrink pulls the Boy back inside; undoing it puts him where he was.
    start: d.start ? { x: d.start.x, y: d.start.y } : undefined });
  d.redo.length = 0;
}

/** Undo (`which` 'before') or redo ('after') a step's family slots and size. */
function editRestoreExtras(step, which) {
  if (step.families) editFamiliesRestore(step.families[which]);
  if (step.resize && typeof requestBlankRoom === 'function') {
    var size = step.resize[which];
    // Cells past the edge are kept, so the size is all there is to put back.
    _resizeKeep = true;
    requestBlankRoom(size.w, size.h);
  }
}
