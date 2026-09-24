// Ownership: pointer and key gestures on the map itself — a stroke, a
// drag, undo/redo. The chrome's clicks are map-editor-input.js; the draft
// is map-editor.js; the map layer is map-editor-paint.js.
//
// Listeners are attached to #rg-wrap in the **capture** phase so a stroke
// is decided before the pan/select handlers on the SVG ever see it; while
// edit mode is off nothing is intercepted and the map behaves exactly as
// before.
//
// Split out of map-editor-input.js for the 400-line limit, along the line
// that was already there: this file is the map, that one is the chrome.

var _editDrag = null;

/** Map coordinates for a pointer event, in metatile cells. */
function editEventCell(e) {
  var svg = document.getElementById('rg-svg');
  if (!svg || !svg.getScreenCTM) return null;
  var pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  var p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return {
    x: Math.floor((p.x - _editOrigin.x) / EDIT_UNITS),
    y: Math.floor((p.y - _editOrigin.y) / EDIT_UNITS),
  };
}

/** A click or drag step with the current tool. */
function editStroke(cell, phase) {
  var d = editDraft();
  if (!d || !editInBounds(_mtPalette, cell.x, cell.y)) return;

  if (d.tool === 'select') {
    // The only tool that reads a click as "pick a trigger" rather than
    // "paint a cell" — see map-editor-trigger-select.js's file header and
    // docs/map-editor-redesign-plan.md Phase 4. A mousedown that lands on
    // the already-selected trigger's own footprint starts a drag instead of
    // re-selecting it, so the same click that begins a drag doesn't also
    // reselect the thing already selected.
    if (phase === 'down') {
      if (triggerDragStart(cell)) return;
      triggerSelect(editTriggerAt(cell.x, cell.y));
      return;
    }
    if (phase === 'move') { triggerDragMove(cell); return; }
    if (phase === 'up') { triggerDragCommit(); return; }
    return;
  }

  if (d.tool === 'pick') {
    if (phase !== 'down') return;
    var at = editCellAt(_mtPalette, cell.x, cell.y);
    if (at >= 0) { d.brush = at; _mtSelected = at; renderMetatilePalette(); }
    renderEditChrome();
    return;
  }

  if (d.tool === 'erase') {
    // editResolve owns what erasing means, and reads it off the cell itself
    // now (§8a.2) — no phase to gate it on, so this runs unconditionally. A
    // special at this cell is a second, independent thing to take off —
    // clearing its glyph and, for gate/drift, the bits it wrote (see
    // map-editor-special.js). Both land in the one final index this cell
    // gets, so undo sees a single write per cell.
    var bare = editResolve(_mtPalette, cell.x, cell.y, -1, true);
    var hadSpecial = editSpecialAt(cell.x, cell.y);
    var finalIndex = bare;
    if (hadSpecial) {
      var base = finalIndex >= 0 ? finalIndex : editCellAt(_mtPalette, cell.x, cell.y);
      var cleared = editSpecialAppliedIndex(_mtPalette, base, null, true);
      if (cleared !== base) finalIndex = cleared;
    }
    var eraseWrites = finalIndex >= 0 ? [{ x: cell.x, y: cell.y, index: finalIndex }] : [];
    var eraseSpecial = hadSpecial ? [{ x: cell.x, y: cell.y, id: null }] : [];
    if (eraseWrites.length || eraseSpecial.length) editApply(eraseWrites, eraseSpecial);
    renderEditChrome();
    return;
  }

  if (d.tool === 'stamp') {
    if (phase !== 'down' || _editConstruct < 0) return;
    var got = editConstructWrites(_mtPalette, d.constructs[_editConstruct], cell.x, cell.y);
    if (got.writes.length) { editApply(got.writes); requestComposedPreview(); }
    if (got.problems.length) editNote(got.problems.join(' · '));
    else if (!got.writes.length) editNote('nothing to place there');
    else editStampedConstruct(d.constructs[_editConstruct], cell.x, cell.y);
    renderEditChrome();
    return;
  }

  if (d.tool === 'paint') {
    // A special is cosmetically independent of the tile brush (the design
    // mock's own note): a click can carry a tile, a special, or both, so
    // there is nothing to do only when neither is armed.
    var hasBrush = d.brush >= 0;
    if (!hasBrush && !d.currentSpecialId) return;
    var before = hasBrush
      ? editResolve(_mtPalette, cell.x, cell.y, d.brush, false)
      : editCellAt(_mtPalette, cell.x, cell.y);
    if (before < 0) return;
    var idx = before;
    var paintSpecial = [];
    if (d.currentSpecialId) {
      // Gate/drift fold their bits into this same index (one final stamp
      // per cell — see editSpecialAppliedIndex); stairs/entrance leave it
      // untouched and only the glyph below is new.
      idx = editSpecialAppliedIndex(_mtPalette, before, d.currentSpecialId, false);
      paintSpecial.push({ x: cell.x, y: cell.y, id: d.currentSpecialId });
    }
    // Only a real brush paint, or a special that actually rewrote the
    // collision word, touches the tile grid. A special-only click with no
    // bitfield of its own (stairs, entrance) leaves the grid untouched —
    // otherwise a plain glyph click would inflate the "N cells" count with
    // an override that changes nothing.
    var paintWrites = (hasBrush || idx !== before) ? [{ x: cell.x, y: cell.y, index: idx }] : [];
    editApply(paintWrites, paintSpecial);
    // A deco stroke (or a special's bit rewrite) can invent a stamp, which
    // the preview sheet must catch up with or the painted cell has no
    // picture to crop from.
    if (idx >= _mtPalette.count) requestComposedPreview();
    renderEditChrome();
    return;
  }

  // rect / copy / move all drag out a rectangle first.
  if (phase === 'down') { _editDrag = { x1: cell.x, y1: cell.y }; _editSel = null; }
  if (!_editDrag) return;
  _editSel = {
    x1: Math.min(_editDrag.x1, cell.x), y1: Math.min(_editDrag.y1, cell.y),
    x2: Math.max(_editDrag.x1, cell.x), y2: Math.max(_editDrag.y1, cell.y),
  };
  if (phase !== 'up') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return; }

  if (d.tool === 'rect') {
    if (d.brush >= 0) editApplyStroke(editRectWrites(_editSel.x1, _editSel.y1, _editSel.x2, _editSel.y2, d.brush, _mtPalette));
    _editSel = null;
  } else if (_editSel.x1 === _editSel.x2 && _editSel.y1 === _editSel.y2 && _editClip) {
    // A single click with something on the clipboard is a paste. Raw indices
    // on purpose: the clipboard holds whole cells lifted off the map, so
    // re-resolving them against what they land on would merge two finished
    // cells rather than copy one.
    editApply(editPasteWrites(_editSel.x1, _editSel.y1, _mtPalette));
    _editSel = null;
  } else {
    // A real drag takes the region; `move` also backfills it.
    var backfill = editTakeSelection(_mtPalette, d.tool === 'move');
    if (backfill.length) editApplyStroke(backfill);
  }
  _editDrag = null;
  renderEditChrome();
}

/**
 * Apply a brush stroke's writes, and refresh the preview sheet if it needs it.
 *
 * `editResolve` can invent a stamp (a front-composed brush over an existing
 * terrain composes a third, merged one), and a cell painted with a stamp the
 * preview sheet does not have yet has no picture to crop from — it renders as
 * nothing. The paint tool has always done this check inline; rect and move
 * did not, which is why they are routed through here rather than calling
 * `editApply` directly.
 */
function editApplyStroke(writes) {
  if (!writes || !writes.length) return;
  editApply(writes);
  for (var i = 0; i < writes.length; i++) {
    if (writes[i].index >= _mtPalette.count) { requestComposedPreview(); return; }
  }
}

/** Attach the capture-phase gesture handlers once per rendered room. */
function setupEditGestures() {
  var wrap = document.getElementById('rg-wrap');
  if (!wrap || wrap.dataset.editBound) return;
  wrap.dataset.editBound = '1';

  var painting = false;
  wrap.addEventListener('mousedown', function (e) {
    if (!editActive() || e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) return;
    // The resize grip lives inside the map, so a drag on it must not also
    // be read as a paint stroke starting in the corner cell.
    if (e.target && e.target.id === 'rg-resize') {
      if (resizeStart(e)) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    var cell = editEventCell(e);
    if (!cell) return;
    painting = true;
    editStroke(cell, 'down');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  wrap.addEventListener('mousemove', function (e) {
    if (_resizing) { resizeMove(e); e.stopPropagation(); return; }
    if (!painting || !editActive()) return;
    var cell = editEventCell(e);
    if (cell) editStroke(cell, 'move');
    e.stopPropagation();
  }, true);

  wrap.addEventListener('mouseup', function (e) {
    if (_resizing) { resizeEnd(); e.stopPropagation(); return; }
    if (!painting || !editActive()) return;
    painting = false;
    var cell = editEventCell(e);
    if (cell) editStroke(cell, 'up');
    e.stopPropagation();
  }, true);
}

/**
 * The text-input guard every keyboard shortcut in this file shares: a
 * shortcut key typed while filtering the family list or naming a new room
 * must reach that input, not the editor. See the webview-dom-safety skill.
 */
function editFocusInTextInput(e) {
  var tag = e.target && e.target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/**
 * Undo/redo, escape to drop a selection, and the Select tool's own
 * shortcuts (Backspace/Delete, Cmd/Ctrl+C/V) — see
 * map-editor-trigger-select.js, which owns what each of these actually does.
 * All of it is inert while a text input has focus, and while edit mode is
 * off, exactly like the undo/redo shortcuts already here.
 */
function setupEditKeys() {
  if (typeof window === 'undefined' || window._editKeysBound) return;
  window._editKeysBound = true;
  window.addEventListener('keydown', function (e) {
    if (!editActive() || editFocusInTextInput(e)) return;
    var d = editDraft();
    if (e.key === 'Escape') {
      _editSel = null; _editClip = null;
      if (d) { d.selectedTriggerRef = null; _triggerDrag = null; }
      renderEditChrome();
      return;
    }
    var mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey ? editRedo(_mtPalette) : editUndo(_mtPalette)) {
        requestComposedPreview();
        renderEditChrome();
        e.preventDefault();
      }
      return;
    }
    if (!d || d.tool !== 'select') return;
    // Paste only needs a clipboard, which can outlive the selection that
    // filled it (Escape clears the selection, not the clipboard); delete and
    // copy both act on whatever is currently selected.
    if (mod && (e.key === 'v' || e.key === 'V')) { triggerPasteClipboard(); e.preventDefault(); return; }
    if (!d.selectedTriggerRef) return;
    if (e.key === 'Backspace' || e.key === 'Delete') { triggerDeleteSelected(); e.preventDefault(); return; }
    if (mod && (e.key === 'c' || e.key === 'C')) { triggerCopySelected(); e.preventDefault(); }
  });
}
