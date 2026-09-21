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

  if (d.tool === 'erase') {
    // The phase decides what "erase" means, and editResolve owns that.
    var bare = editResolve(_mtPalette, cell.x, cell.y, -1, d.phase, true);
    if (bare >= 0) editApply([{ x: cell.x, y: cell.y, index: bare }]);
    renderEditChrome();
    return;
  }

  if (d.tool === 'stamp') {
    if (phase !== 'down' || _editConstruct < 0) return;
    var writes = editConstructWrites(_mtPalette, d.constructs[_editConstruct], cell.x, cell.y);
    if (writes.length) { editApply(writes); requestComposedPreview(); }
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
  host.innerHTML = buildComposerHtml() + buildConstructsHtml();
  renderComposerPreview();
}

/**
 * Every data attribute a click on this panel can mean.
 *
 * Needed because `e.target` is the *deepest* node under the pointer, which
 * is often a `<span>` inside the button rather than the button. Clicking
 * the caret of a collapsible panel put the span in `e.target`, its dataset
 * was empty, and the panel silently refused to open — proven in a real
 * browser before this walk-up existed.
 */
var EDIT_CLICK_KEYS = ['editTool', 'editPhase', 'editAct', 'editPick', 'panel',
  'famSlot', 'famAdd', 'famPick', 'construct', 'tileSource', 'mtIndex'];

/** The nearest ancestor (including `el`) that carries one of those keys. */
function editClickTarget(el, root) {
  for (var n = el; n && n !== root; n = n.parentNode) {
    if (!n.dataset) continue;
    for (var i = 0; i < EDIT_CLICK_KEYS.length; i++) {
      var v = n.dataset[EDIT_CLICK_KEYS[i]];
      if (v !== undefined && v !== '') return n;
    }
  }
  return el;
}

/** The editor's own delegated click handler, for the bar and the composer. */
function bindEditControls(panel, room) {
  // The family filter is the one text input in the editor. Delegated on
  // `input` so it survives the redraws it causes.
  panel.addEventListener('input', function (e) {
    if (!e.target || e.target.id !== 'rg-fam-filter') return;
    _famFilter = e.target.value;
    renderEditPanels();
  });

  panel.addEventListener('click', function (e) {
    var t = editClickTarget(e.target, panel);
    if (!t || !t.dataset) return;

    if (t.id === 'rg-edit-btn') { editToggle(room, t); return; }
    if (t.dataset.editTool) {
      var d = editDraft();
      if (d) { d.tool = t.dataset.editTool; _editSel = null; renderEditChrome(); }
      return;
    }
    if (t.dataset.editPhase) {
      var dp = editDraft();
      if (dp) {
        dp.phase = t.dataset.editPhase;
        // Erase has no meaning while laying the room out, so leaving deco
        // with it selected would arm a tool that does nothing.
        if (dp.phase !== 'deco' && dp.tool === 'erase') dp.tool = 'paint';
        renderEditChrome();
      }
      return;
    }
    if (t.dataset.panel) {
      _panelOpen[t.dataset.panel] = _panelOpen[t.dataset.panel] === false;
      renderEditPanels();
      return;
    }
    if (t.dataset.famSlot !== undefined && t.dataset.famSlot !== '') {
      var slot = Number(t.dataset.famSlot);
      _famOpen = _famOpen === slot ? -1 : slot;
      _famPicking = -1;
      if (_famOpen >= 0) ensureFamilySheet(editFamilies()[_famOpen]);
      renderEditPanels();
      return;
    }
    if (t.dataset.famAdd !== undefined && t.dataset.famAdd !== '') {
      // The same control frees a filled slot and fills an empty one: both
      // are "decide what goes here".
      _famPicking = _famPicking === Number(t.dataset.famAdd) ? -1 : Number(t.dataset.famAdd);
      _famOpen = -1;
      if (_famPicking >= 0) requestFamilyCatalogue();
      renderEditPanels();
      return;
    }
    if (t.dataset.famPick) {
      var pick = t.dataset.famPick;
      if (pick === 'clear') editClearFamily(_famPicking);
      else if (pick !== 'none') editSetFamily(_famPicking, Number(pick));
      _famPicking = -1;
      renderEditChrome();
      return;
    }
    if (t.dataset.tileSource) { _tileSource = t.dataset.tileSource; renderEditPanels(); return; }
    if (t.dataset.famTile) {
      // A tile from a family strip. Picking it is what pulls the family in.
      var got = editAdoptFamilyFor(Number(t.dataset.famOf));
      editNote(got.ok
        ? (got.added ? 'added family ' + t.dataset.famOf + ' to slot ' + (got.slot + 1)
          : 'family ' + t.dataset.famOf + ' is already in slot ' + (got.slot + 1))
          + ' — graphic ' + t.dataset.famTile
        : got.why);
      renderEditPanels();
      return;
    }
    if (t.dataset.construct) {
      _editConstruct = Number(t.dataset.construct);
      var dc = editDraft();
      if (dc) dc.tool = 'stamp';
      renderEditChrome();
      renderComposer();
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
