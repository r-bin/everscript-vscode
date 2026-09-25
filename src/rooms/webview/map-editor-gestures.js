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

/** The cuttable layer is the one being drawn on (map-editor-cutlayer.js). */
function cutLayerActive() {
  return typeof editCutLayerOn === 'function' && editCutLayerOn();
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
    // The eraser takes off what the pencil would put down: a trigger on the
    // Trigger tab, the special alone on the Special tab (map-editor-drawable.js).
    var eraseKind = drawKind();
    if (eraseKind === 'trigger') {
      if (phase === 'down') editEraseTriggerAt(cell);
      return;
    }
    if (eraseKind === 'special') {
      if (editSpecialAt(cell.x, cell.y)) editSpecialStroke(d, cell, true);
      renderEditChrome();
      return;
    }
    // On the cuttable layer, erase takes the cuttable tile off whole.
    if (cutLayerActive()) {
      var cutErase = editCutWrite(cell.x, cell.y, -1, true);
      if (cutErase) editApply([cutErase]);
      renderEditChrome();
      return;
    }
    var bare = editResolve(_mtPalette, cell.x, cell.y, -1, true);
    var hadSpecial = editSpecialAt(cell.x, cell.y);
    var finalIndex = bare;
    if (hadSpecial) {
      var base = finalIndex >= 0 ? finalIndex : editCellAt(_mtPalette, cell.x, cell.y);
      var cleared = editSpecialAppliedIndex(_mtPalette, base, null, true);
      if (cleared !== base) finalIndex = cleared;
    }
    var eraseWrites = finalIndex >= 0 ? [{ x: cell.x, y: cell.y, index: finalIndex }] : [];
    // The whole painted cell: take the draft's write back (the room's own
    // tile shows again — nothing, on a new map).
    if (finalIndex === EDIT_ERASE_CELL && Object.prototype.hasOwnProperty.call(d.cells, editKey(cell.x, cell.y))) {
      eraseWrites = [{ x: cell.x, y: cell.y, index: null }];
    }
    var eraseSpecial = hadSpecial ? [{ x: cell.x, y: cell.y, id: null }] : [];
    if (eraseWrites.length || eraseSpecial.length) editApply(eraseWrites, eraseSpecial);
    renderEditChrome();
    return;
  }

  var kind = drawKind();
  if (d.tool === 'stamp' || (d.tool === 'paint' && kind === 'widgets')) {
    if (phase !== 'down' || _editConstruct < 0) return;
    var got = editConstructWrites(_mtPalette, d.constructs[_editConstruct], cell.x, cell.y);
    if (got.writes.length) { editApply(got.writes); requestComposedPreview(); }
    if (got.problems.length) editNote(got.problems.join(' · '));
    else if (!got.writes.length) editNote('nothing to place there');
    else editStampedConstruct(d.constructs[_editConstruct], cell.x, cell.y);
    renderEditChrome();
    return;
  }

  // The Trigger tab's pencil (and rect) drag out a new trigger's box.
  if (kind === 'trigger' && (d.tool === 'paint' || d.tool === 'rect')) { editTriggerStroke(cell, phase); return; }

  if (d.tool === 'paint' && kind === 'special') { editSpecialStroke(d, cell, false, phase); return; }

  if (d.tool === 'paint') {
    // The Tile tab's pencil puts down the armed tile and nothing else — the
    // armed special is the Special tab's (map-editor-drawable.js).
    if (d.brush < 0) return;
    if (cutLayerActive()) {
      editApplyStroke([editCutWrite(cell.x, cell.y, d.brush, false)].filter(Boolean));
      renderEditChrome();
      return;
    }
    var idx = editResolve(_mtPalette, cell.x, cell.y, d.brush, false);
    if (idx < 0) return;
    editApplyStroke([{ x: cell.x, y: cell.y, index: idx }]);
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
    // The rectangle fills with the tab's drawable too: specials cell by
    // cell; a widget is placed with the pencil, not filled.
    if (kind === 'special' && d.currentSpecialId && d.currentSpecialId !== START_SPECIAL_ID) {
      var sw = [], ss = [];
      for (var ry = _editSel.y1; ry <= _editSel.y2; ry++) {
        for (var rx = _editSel.x1; rx <= _editSel.x2; rx++) {
          var one = editSpecialWrites(d, { x: rx, y: ry }, false);
          if (one) { sw = sw.concat(one.writes); ss = ss.concat(one.special); }
        }
      }
      editApplySpecial(sw, ss);
    } else if (kind === 'tile' && d.brush >= 0) {
      editApplyStroke(cutLayerActive()
        ? editCutRectWrites(_editSel.x1, _editSel.y1, _editSel.x2, _editSel.y2, d.brush)
        : editRectWrites(_editSel.x1, _editSel.y1, _editSel.x2, _editSel.y2, d.brush, _mtPalette));
    }
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

/** Which tab's drawable the pencil and eraser use (map-editor-drawable.js). */
function drawKind() {
  return typeof editDrawKind === 'function' ? editDrawKind() : 'tile';
}

/**
 * The Special tab's pencil: the armed special on the cell, and nothing else.
 *
 * Gate, drift and diagonal stairs fold their bits into the cell's stamp (one
 * final stamp per cell — editSpecialAppliedIndex); vertical stairs and
 * entrance only add the glyph, so they leave the grid untouched — otherwise
 * a glyph click would inflate the "N cells" count with an override that
 * changes nothing. `erasing` takes the special off, bits and glyph.
 */
function editSpecialStroke(d, cell, erasing, phase) {
  if (!erasing && editStartGesture(cell, phase)) return;
  var w = editSpecialWrites(d, cell, erasing);
  if (!w) return;
  editApplySpecial(w.writes, w.special);
  if (!erasing) renderEditChrome();
}

/** What one special pick (or its removal) writes at a cell, or null. */
function editSpecialWrites(d, cell, erasing) {
  if (!erasing && !d.currentSpecialId) return null;
  var before = editCellAt(_mtPalette, cell.x, cell.y);
  if (before < 0) return null;
  var idx = editSpecialAppliedIndex(_mtPalette, before, erasing ? null : d.currentSpecialId, erasing);
  return {
    writes: idx !== before ? [{ x: cell.x, y: cell.y, index: idx }] : [],
    special: [{ x: cell.x, y: cell.y, id: erasing ? null : d.currentSpecialId }],
  };
}

/** One undo step for special writes, and a preview refresh if they made a stamp. */
function editApplySpecial(writes, special) {
  if (!special.length) return;
  editApply(writes, special);
  for (var i = 0; i < writes.length; i++) {
    if (writes[i].index >= _mtPalette.count) { requestComposedPreview(); return; }
  }
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
