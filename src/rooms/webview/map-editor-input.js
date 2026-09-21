// Ownership: turning pointer and key events into edits. The last piece of
// the editor — state is map-editor.js, the map layer is
// map-editor-paint.js, the chrome is map-editor-ui.js.
//
// Listeners are attached to #rg-wrap in the **capture** phase so a stroke
// is decided before the pan/select handlers on the SVG ever see it; while
// edit mode is off nothing is intercepted and the map behaves exactly as
// before.

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

  if (d.tool === 'paint') {
    if (d.brush < 0) return;
    editApply([{ x: cell.x, y: cell.y, index: d.brush }]);
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
    var cell = editEventCell(e);
    if (!cell) return;
    painting = true;
    editStroke(cell, 'down');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  wrap.addEventListener('mousemove', function (e) {
    if (!painting || !editActive()) return;
    var cell = editEventCell(e);
    if (cell) editStroke(cell, 'move');
    e.stopPropagation();
  }, true);

  wrap.addEventListener('mouseup', function (e) {
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
    if (e.shiftKey ? editRedo() : editUndo()) { renderEditChrome(); e.preventDefault(); }
  });
}

/** A stamp was clicked in the palette or the composer preview. */
function editOnStampPicked(index) {
  var d = editDraft();
  if (!d || !d.on) return false;
  var slot = _editCompose.pick;
  if (slot && _editCompose.armed) {
    var w = editStampWords(_mtPalette, index);
    if (w) _editCompose[slot] = slot === 'collision' ? w.collision : w[slot];
    _editCompose.armed = false;
    renderComposer();
    return true;
  }
  d.brush = index;
  renderEditChrome();
  return false;
}

/**
 * A raw graphic was clicked in the tiles view.
 *
 * Only a layer source can take it: a tilemap word says which picture and
 * which family, and nothing in it says what is solid, so the collision slot
 * stays armed and waits for a stamp instead.
 */
function editOnTilePicked(word) {
  var d = editDraft();
  if (!d || !d.on || word == null || !_editCompose.armed) return false;
  if (_editCompose.pick === 'collision') {
    editNote('a graphic carries no collision — click a stamp for that');
    return false;
  }
  _editCompose[_editCompose.pick] = word;
  _editCompose.armed = false;
  renderComposer();
  return true;
}

/** Say something in the editor's status slot. */
function editNote(text) {
  var el = document.getElementById('rg-edit-count');
  if (el) el.textContent = text;
}

/** Redraw just the composer block, keeping the palette sheet untouched. */
function renderComposer() {
  var host = document.getElementById('rg-compose');
  if (!host) return;
  host.innerHTML = buildComposerHtml();
  renderComposerPreview();
}

/** The editor's own delegated click handler, for the bar and the composer. */
function bindEditControls(panel, room) {
  panel.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.dataset) return;

    if (t.id === 'rg-edit-btn') { editToggle(room, t); return; }
    if (t.dataset.editTool) {
      var d = editDraft();
      if (d) { d.tool = t.dataset.editTool; _editSel = null; renderEditChrome(); }
      return;
    }
    if (t.dataset.editPick) {
      _editCompose.pick = t.dataset.editPick;
      _editCompose.armed = true;
      renderComposer();
      return;
    }
    if (t.dataset.editAct) { editAction(t.dataset.editAct); return; }
    // A composed stamp in the preview strip.
    if (t.dataset.mtIndex && t.parentNode && t.parentNode.parentNode
        && t.parentNode.parentNode.id === 'rg-compose-preview') {
      editOnStampPicked(Number(t.dataset.mtIndex));
      renderComposerPreview();
    }
  });
}

function editAction(act) {
  var d = editDraft();
  if (!d) return;
  if (act === 'undo') { editUndo(); renderEditChrome(); return; }
  if (act === 'redo') { editRedo(); renderEditChrome(); return; }
  if (act === 'clear') {
    editReset(d.roomId).on = true;
    _editSel = null; _editClip = null; _editComposed = null;
    renderEditChrome(); renderComposer();
    return;
  }
  if (act === 'compose-brush') {
    // The shortest path to a working stamp: take one that already works and
    // change the one word you care about.
    var pick = d.brush >= 0 ? d.brush : _mtSelected;
    var w = pick >= 0 ? editStampWords(_mtPalette, pick) : null;
    if (!w) { editNote('select a stamp first — “from brush” copies the selected one'); return; }
    _editCompose.layer1 = w.layer1;
    _editCompose.layer2 = w.layer2;
    _editCompose.collision = w.collision;
    _editCompose.armed = false;
    renderComposer();
    return;
  }
  if (act === 'compose-swap') {
    var src = _editCompose.layer2 != null ? editFindCollisionFor(_editCompose.layer2) : null;
    if (src == null) { editNote('no stamp in this room draws that terrain word yet'); return; }
    _editCompose.collision = src;
    renderComposer();
    return;
  }
  if (act === 'compose-add') {
    if (_editCompose.layer1 == null || _editCompose.layer2 == null) {
      editNote('a stamp needs both a canopy and a terrain word');
      return;
    }
    var coll = _editCompose.collision != null ? _editCompose.collision
      : (editFindCollisionFor(_editCompose.layer2) || 0);
    d.brush = editAddStamp(_mtPalette, {
      layer1: _editCompose.layer1, layer2: _editCompose.layer2, collision: coll,
    });
    requestComposedPreview();
    renderEditChrome(); renderComposer();
    return;
  }
  if (act === 'export') editCopyDraft();
}

/** The collision word the room already uses with this terrain word. */
function editFindCollisionFor(layer2Word) {
  if (!_mtPalette) return null;
  for (var i = 0; i < _mtPalette.count; i++) {
    if (_mtPalette.entries[i][2] === layer2Word) return _mtPalette.entries[i][3];
  }
  return null;
}

/** Hand the draft over as JSON — nothing writes to the ROM yet. */
function editCopyDraft() {
  var json = JSON.stringify(editExport(_mtPalette), null, 2);
  var note = document.getElementById('rg-edit-count');
  if (navigator && navigator.clipboard) {
    navigator.clipboard.writeText(json).then(function () {
      if (note) note.textContent = 'draft copied to the clipboard';
    }, function () { if (note) note.textContent = 'could not copy'; });
  }
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'mapEditDraft', draft: editExport(_mtPalette) });
}

/** Turn edit mode on or off for the room on screen. */
function editToggle(room, btn) {
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : null;
  if (id == null) return;
  var d = editDraft();
  if (!d || d.roomId !== id) d = editReset(id);
  d.on = !d.on;
  if (btn) btn.classList.toggle('on', d.on);
  var panel = document.getElementById('room-detail');
  if (panel) panel.classList.toggle('rg-editing', d.on);
  editDock(d.on, room);

  var bar = document.getElementById('rg-edit-bar');
  if (d.on && !bar) {
    var outer = document.getElementById('rg-outer');
    if (outer) outer.insertAdjacentHTML('afterbegin', buildEditToolbarHtml());
    var sec = document.getElementById('rs-mt');
    if (sec && !document.getElementById('rg-compose')) {
      sec.insertAdjacentHTML('beforeend', '<div id="rg-compose"></div>');
    }
    renderComposer();
  } else if (!d.on && bar) {
    bar.parentNode.removeChild(bar);
  }
  renderEditChrome();
}
