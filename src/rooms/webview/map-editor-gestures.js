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
/** The cell under the pointer, or null — where Cmd/Ctrl+V pastes. */
var _editHover = null;
/** Ends the gesture in progress when the button comes up off the map. */
var _editGestureRelease = null;

/** Map coordinates for a pointer event, in metatile cells. */
function editEventCell(e) {
  var svg = document.getElementById('rg-svg');
  if (!svg || !svg.getScreenCTM) return null;
  var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  var p = pt.matrixTransform(svg.getScreenCTM().inverse()), ux = (p.x - _editOrigin.x) / EDIT_UNITS, uy = (p.y - _editOrigin.y) / EDIT_UNITS;
  // qx/qy: which 8px quarter of the 16px cell — the Collision tab draws on them (map-editor-collision-tab.js).
  return { x: Math.floor(ux), y: Math.floor(uy), qx: ux - Math.floor(ux) >= 0.5 ? 1 : 0, qy: uy - Math.floor(uy) >= 0.5 ? 1 : 0 };
}

/** The cuttable layer is the one being drawn on (map-editor-cutlayer.js). */
function cutLayerActive() {
  return typeof editCutLayerOn === 'function' && editCutLayerOn();
}

/** A click or drag step with the current tool. */
function editStroke(cell, phase) {
  var d = editDraft();
  if (!d) return;
  if (phase !== 'down' && _mtPalette && _mtPalette.widthTiles && _mtPalette.heightTiles) {
    cell = { x: Math.max(0, Math.min(_mtPalette.widthTiles - 1, cell.x)), y: Math.max(0, Math.min(_mtPalette.heightTiles - 1, cell.y)), qx: cell.qx, qy: cell.qy };
  }
  if (!editInBounds(_mtPalette, cell.x, cell.y)) return;
  // Locked: the eyedropper, a copy box and selecting a trigger — nothing that writes.
  if (editLocked() && d.tool !== 'pick' && d.tool !== 'copy') {
    if (phase !== 'down') return;
    if (d.tool === 'select') { triggerSelect(editTriggerAt(cell.x, cell.y)); return; }
    editNote('this map is locked — unlock it in the bar below the map to change it');
    renderEditChrome();
    return;
  }

  // A copy on the pointer: the click puts it down, whatever the tool (map-editor-clipboard.js).
  if (typeof _pasteFloat !== 'undefined' && _pasteFloat) {
    if (phase === 'down') editPasteFloatPlace();
    return;
  }
  // The Object tab: areas, and the tiles drawn over them (map-editor-objects.js).
  var objActive = drawKind() === 'object' || (drawKind() === 'tile' && typeof _objectActiveFrame !== 'undefined' && _objectActiveFrame >= 1 && typeof _objectSel !== 'undefined' && _objectSel != null);
  if ((drawKind() === 'anim' && editAnimGesture(d, cell, phase)) || (objActive && typeof editObjectGesture === 'function' && editObjectGesture(d, cell, phase))) return;

  if (d.tool === 'select') {
    // The only tool that reads a click as "pick a trigger" rather than
    // "paint a cell" — see map-editor-trigger-select.js's file header and
    // docs/map-editor-redesign-plan.md Phase 4. A mousedown that lands on
    // the already-selected trigger's own footprint starts a drag instead of
    // re-selecting it, so the same click that begins a drag doesn't also
    // reselect the thing already selected.
    // The Boy first: he stands on top of everything (map-editor-start.js).
    if (typeof startSelectGesture === 'function' && startSelectGesture(cell, phase)) return;
    // On the Special tab the Select tool picks a cell's specials (map-editor-special-select.js).
    if (drawKind() === 'special' && typeof specialSelectGesture === 'function'
      && specialSelectGesture(cell, phase)) return;
    if (phase === 'down') {
      if (triggerDragStart(cell)) return;
      // What the open tab is about comes first: on the Trigger tab a trigger
      // over a stamped object is the trigger; elsewhere the object (its own
      // B-trigger covers it, and clicking a gourd means the gourd).
      var trig = editTriggerAt(cell.x, cell.y);
      if (drawKind() === 'trigger' && trig) { triggerSelect(trig); return; }
      if (groupSelectGesture(cell, phase)) return;
      triggerSelect(trig); return;
    }
    if (groupSelectGesture(cell, phase)) return;
    if (phase === 'move') { triggerDragMove(cell); return; }
    if (phase === 'up') { triggerDragCommit(); return; }
    return;
  }

  if (d.tool === 'pick') {
    if (phase !== 'down') return;
    if (typeof editSmartPick === 'function') { editSmartPick(cell); return; }
    var at = editCellAt(_mtPalette, cell.x, cell.y);
    if (at >= 0) { d.brush = at; _mtSelected = at; }
    renderEditChrome(); return;
  }

  if (d.tool === 'erase') {
    var eraseKind = drawKind();
    if (eraseKind === 'trigger') { if (phase === 'down') editEraseTriggerAt(cell); return; }
    if (eraseKind === 'collision') { editCollisionStroke(cell, true); return; }
    // A placed widget's tiles are locked to it: disband it to erase them (map-editor-groups.js).
    var grp = typeof editGroupAt === 'function' && !cutLayerActive() ? editGroupAt(cell.x, cell.y) : null;
    if (grp) { if (phase === 'down') editGroupLockNote(grp); return; }
    if (eraseKind === 'special') { editSpecialStroke(d, cell, true); renderEditChrome(); return; }
    editEraseCells(d, cell, phase);
    renderEditChrome(); return;
  }

  var kind = drawKind();
  if (d.tool === 'stamp' || (d.tool === 'paint' && kind === 'widgets')) {
    if (phase !== 'down' || _editConstruct < 0) return;
    // One group: moved and deleted whole with the Select tool (map-editor-groups.js).
    var got = editStampGroup(_mtPalette, d.constructs[_editConstruct], cell.x, cell.y);
    if (got.writes.length) requestComposedPreview();
    if (got.problems.length) editNote(got.problems.join(' · '));
    else if (!got.writes.length && !got.placed) editNote('nothing to place there');
    renderEditChrome(); return;
  }

  // The Trigger tab's pencil drags out a new trigger's box.
  if (kind === 'trigger' && d.tool === 'paint') { editTriggerStroke(cell, phase); return; }

  if (d.tool === 'paint' && kind === 'special') { editSpecialStroke(d, cell, false, phase); return; }
  if (d.tool === 'paint' && kind === 'collision') { editCollisionStroke(cell, false); return; }

  if (d.tool === 'paint') {
    // The Tile tab's pencil puts down the armed tile and nothing else — the
    // armed special is the Special tab's (map-editor-drawable.js).
    if (d.brush < 0 || (typeof editAnimTileStroke === 'function' && !cutLayerActive() && editAnimTileStroke(d, cell, phase))) return;
    // Every tile lands on the level picked in the left bar (map-editor-levels.js).
    if (cutLayerActive()) {
      editApplyStroke(onLevel([editCutWrite(cell.x, cell.y, d.brush, false)].filter(Boolean)));
      renderEditChrome(); return;
    }
    var idx = editResolve(_mtPalette, cell.x, cell.y, d.brush, false);
    if (idx < 0) return;
    editApplyStroke(onLevel([{ x: cell.x, y: cell.y, index: idx }]));
    renderEditChrome(); return;
  }

  // The copy tool: a pasted object, selected, moves by dragging it; a drag
  // anywhere else selects a region for Cmd/Ctrl+C (map-editor-clipboard.js).
  if (d.tool === 'copy' && typeof _groupSel !== 'undefined' && (phase !== 'down' || _groupSel != null)) {
    if (phase === 'down' ? groupDragSelected(cell) : groupSelectGesture(cell, phase)) return;
  }

  // copy / move drag out a rectangle first.
  if (phase === 'down') {
    _editDrag = { x1: cell.x, y1: cell.y }; _editSel = null;
    if (d.tool === 'copy' && typeof editDeselectAll === 'function') editDeselectAll();
  }
  if (!_editDrag) return;
  _editSel = { x1: Math.min(_editDrag.x1, cell.x), y1: Math.min(_editDrag.y1, cell.y),
    x2: Math.max(_editDrag.x1, cell.x), y2: Math.max(_editDrag.y1, cell.y) };
  if (phase !== 'up') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return; }

  if (d.tool === 'copy') {
    // The region stays selected for Cmd/Ctrl+C; nothing is stamped by a click.
    editNote((_editSel.x2 - _editSel.x1 + 1) + '×' + (_editSel.y2 - _editSel.y1 + 1)
      + ' selected — Cmd/Ctrl+C to copy it, Cmd/Ctrl+V to paste it as one object');
  } else if (_editSel.x1 === _editSel.x2 && _editSel.y1 === _editSel.y2 && _editClip) {
    // A single click with something on the clipboard is a paste. Raw indices
    // on purpose: the clipboard holds whole cells lifted off the map, so
    // re-resolving them against what they land on would merge two finished
    // cells rather than copy one.
    editApply(editPasteWrites(_editSel.x1, _editSel.y1, _mtPalette)); _editSel = null;
  } else {
    // A real drag takes the region; `move` also backfills it.
    var backfill = editTakeSelection(_mtPalette, d.tool === 'move');
    if (backfill.length) editApplyStroke(backfill);
  }
  _editDrag = null;
  renderEditChrome();
}

/** Writes moved onto the current level, when the levels file is loaded. */
function onLevel(writes) {
  return typeof editWritesOnLevel === 'function' ? editWritesOnLevel(_mtPalette, writes) : writes;
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
  if (typeof _objectActiveFrame !== 'undefined' && _objectActiveFrame >= 1) {
    var sel = (typeof editObjectFind === 'function' && typeof _objectSel !== 'undefined' && _objectSel != null) ? editObjectFind(_objectSel) : null;
    if (!sel && typeof editObjects === 'function') {
      var objs = editObjects();
      for (var i = 0; i < objs.length; i++) {
        if (cell.x >= objs[i].x && cell.y >= objs[i].y && cell.x < objs[i].x + objs[i].w && cell.y < objs[i].y + objs[i].h) { sel = objs[i]; break; }
      }
    }
    if (sel && typeof editObjectContains === 'function' && editObjectContains(sel, cell)) {
      if (editSpecialObjectWrite(sel, cell, erasing ? null : d.currentSpecialId, erasing, phase)) {
        if (!erasing) renderEditChrome();
        return;
      }
    }
  }
  var w = editSpecialWrites(d, cell, erasing);
  if (!w) return;
  editApplySpecial(w.writes, w.special);
  if (!erasing) renderEditChrome();
}

function editSpecialObjectWrite(o, cell, specialId, erase, phase) {
  if (phase === 'down') editBegin();
  var frames = editObjectFrames(o), cur = frames[_objectActiveFrame - 1] || {};
  var k = (cell.x - o.x) + ',' + (cell.y - o.y), before = cur[k] != null ? cur[k] : editCellAt(_mtPalette, cell.x, cell.y);
  if (before < 0) { var d = editDraft(); before = d && d.blank && d.blank.floor != null ? d.blank.floor : 0; }
  var idx = editSpecialAppliedIndex(_mtPalette, before, erase ? null : specialId, erase);
  cur[k] = idx; frames[_objectActiveFrame - 1] = cur; o.layer = cur;
  o.frameSpecials = o.frameSpecials || [];
  while (o.frameSpecials.length < frames.length) o.frameSpecials.push({});
  if (erase) delete o.frameSpecials[_objectActiveFrame - 1][k];
  else o.frameSpecials[_objectActiveFrame - 1][k] = specialId;
  if (typeof editCellsChanged === 'function') editCellsChanged();
  requestComposedPreview(); renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  if (phase === 'up') editEnd();
  return true;
}

/** What one special pick (or its removal) writes at a cell, or null. */
function editSpecialWrites(d, cell, erasing) {
  if (!erasing && !d.currentSpecialId) return null;
  var before = editCellAt(_mtPalette, cell.x, cell.y);
  if (before < 0) {
    if (erasing) return null;
    before = d.blank && d.blank.floor != null ? d.blank.floor : 0;
  }
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
  for (var i = 0; i < writes.length; i++) if (writes[i].index >= _mtPalette.count) { requestComposedPreview(); return; }
}

/** Apply a brush stroke's writes, and refresh the preview sheet if it needs it. */
function editApplyStroke(writes) {
  if (!writes || !writes.length) return;
  editApply(writes);
  for (var i = 0; i < writes.length; i++) if (writes[i].index >= _mtPalette.count) { requestComposedPreview(); return; }
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
    _editHover = cell;
    painting = true;
    // The stroke itself shows what it does from here on (map-editor-preview.js).
    if (typeof editPreviewHover === 'function') editPreviewHover(null);
    // Down to up is one gesture and one undo step, however many cells it
    // crosses (map-editor.js editBegin).
    editBegin();
    editStroke(cell, 'down');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  wrap.addEventListener('mousemove', function (e) {
    if (_resizing) { resizeMove(e); e.stopPropagation(); return; }
    // Where a paste lands (map-editor-clipboard.js).
    if (editActive()) {
      _editHover = editEventCell(e);
      if (typeof _pasteFloat !== 'undefined' && _pasteFloat) editPasteFloatMove(_editHover);
      // What a click here would do, before it does it (map-editor-preview.js).
      if (!painting && typeof editPreviewHover === 'function') editPreviewHover(_editHover);
    }
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
    editEnd();
    renderEditChrome();
    e.stopPropagation();
  }, true);

  // Off the map, nothing is about to happen there.
  wrap.addEventListener('mouseleave', function () {
    if (typeof editPreviewHover === 'function') editPreviewHover(null);
  });

  // Released outside the map: the gesture still ends, as one step.
  _editGestureRelease = function () {
    if (!painting) return;
    painting = false; editEnd(); renderEditChrome();
  };
  if (typeof window !== 'undefined' && window.addEventListener && !window._editReleaseBound) {
    window._editReleaseBound = true;
    window.addEventListener('mouseup', function (e) {
      if (painting && editActive()) {
        painting = false; var cell = editEventCell(e);
        if (cell) editStroke(cell, 'up');
      }
      if (_editGestureRelease) _editGestureRelease();
    });
  }
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
      _editSel = null; _editClip = null; if (typeof _pasteFloat !== 'undefined') _pasteFloat = null;
      if (typeof editDeselectAll === 'function') editDeselectAll();
      // Whatever is on the pointer goes too (map-editor-drawable.js).
      editPutDown(d);
      renderEditChrome();
      return;
    }
    var mod = e.metaKey || e.ctrlKey;
    // Locked: copying is the only key that does anything (no undo, paste or delete).
    if (editLocked() && !(mod && /^[cCaA]$/.test(e.key))) return; // copying and selecting all
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey ? editRedo(_mtPalette) : editUndo(_mtPalette)) {
        requestComposedPreview();
        renderEditChrome();
        e.preventDefault();
      }
      return;
    }
    // Regions and objects: copy, paste, delete (map-editor-clipboard.js) —
    // before the Select tool's own trigger shortcuts below.
    if (d && typeof editClipboardKey === 'function' && editClipboardKey(e, mod)) { e.preventDefault(); return; }
    if (!d || d.tool !== 'select') return;
    if (typeof _groupSel !== 'undefined' && _groupSel != null && (e.key === 'Backspace' || e.key === 'Delete')) {
      if (editGroupDelete(_groupSel)) { requestComposedPreview(); renderEditChrome(); }
      e.preventDefault();
      return;
    }
    // Paste only needs a clipboard, which can outlive the selection that
    // filled it (Escape clears the selection, not the clipboard); delete and
    // copy both act on whatever is currently selected.
    if (mod && (e.key === 'v' || e.key === 'V')) { triggerPasteClipboard(); e.preventDefault(); return; }
    if (!d.selectedTriggerRef) return;
    if (e.key === 'Backspace' || e.key === 'Delete') { triggerDeleteSelected(); e.preventDefault(); return; }
    if (mod && (e.key === 'c' || e.key === 'C')) { triggerCopySelected(); e.preventDefault(); }
  });
}
