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

  if (d.tool === 'pick') {
    if (phase !== 'down') return;
    var at = editCellAt(_mtPalette, cell.x, cell.y);
    if (at >= 0) { d.brush = at; _mtSelected = at; renderMetatilePalette(); }
    renderEditChrome();
    return;
  }

  if (d.tool === 'erase') {
    // The phase decides what "erase" means, and editResolve owns that.
    var bare = editResolve(_mtPalette, cell.x, cell.y, -1, d.phase, true);
    if (bare >= 0) editApply([{ x: cell.x, y: cell.y, index: bare }]);
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
    if (d.brush < 0) return;
    var idx = editResolve(_mtPalette, cell.x, cell.y, d.brush, d.phase, false);
    if (idx < 0) return;
    editApply([{ x: cell.x, y: cell.y, index: idx }]);
    // A deco stroke can invent a stamp, which the preview sheet must catch
    // up with or the painted cell has no picture to crop from.
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
    if (d.brush >= 0) editApply(editRectWrites(_editSel.x1, _editSel.y1, _editSel.x2, _editSel.y2, d.brush, _mtPalette));
    _editSel = null;
  } else if (_editSel.x1 === _editSel.x2 && _editSel.y1 === _editSel.y2 && _editClip) {
    // A single click with something on the clipboard is a paste.
    editApply(editPasteWrites(_editSel.x1, _editSel.y1, _mtPalette));
    _editSel = null;
  } else {
    // A real drag takes the region; `move` also backfills it.
    var backfill = editTakeSelection(_mtPalette, d.tool === 'move');
    if (backfill.length) editApply(backfill);
  }
  _editDrag = null;
  renderEditChrome();
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

/** Undo/redo, and escape to drop a selection. */
function setupEditKeys() {
  if (typeof window === 'undefined' || window._editKeysBound) return;
  window._editKeysBound = true;
  window.addEventListener('keydown', function (e) {
    if (!editActive()) return;
    if (e.key === 'Escape') { _editSel = null; _editClip = null; renderEditChrome(); return; }
    var mod = e.metaKey || e.ctrlKey;
    if (!mod || (e.key !== 'z' && e.key !== 'Z')) return;
    if (e.shiftKey ? editRedo(_mtPalette) : editUndo(_mtPalette)) {
      requestComposedPreview();
      renderEditChrome();
      e.preventDefault();
    }
  });
}
