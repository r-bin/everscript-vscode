// Ownership: copy and paste of map regions and stamped objects.
//
// The copy tool selects a region; Cmd/Ctrl+C copies it (its cells, and the
// triggers and objects on it); Cmd/Ctrl+V pastes it where the pointer is, as
// one object — a group (map-editor-groups.js) — selected, so it can be
// dragged into place until something else is selected. A selected group
// copies the same way. Click-to-stamp is gone: a paste is placed by moving
// it, not by guessing the click.
//
// A trigger selected with the Select tool keeps its own copy and paste
// (map-editor-trigger-select.js); whichever was copied last is what pastes.
//
// Owns: _regionClip, _pasteFloat.

/** The copied construct, or null. */
var _regionClip = null;
/** `{x, y}`: the copy on the pointer, top-left, waiting for a click; or null. */
var _pasteFloat = null;

/**
 * The keyboard half: returns true when it handled the key. Called from the
 * one keydown handler (map-editor-gestures.js setupEditKeys).
 */
function editClipboardKey(e, mod) {
  var d = editDraft();
  if (!d) return false;
  var key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && key === 'c') return editCopy(d);
  if (mod && key === 'v') return editPaste(d);
  if ((e.key === 'Backspace' || e.key === 'Delete') && _groupSel != null && d.tool !== 'select') {
    if (editGroupDelete(_groupSel)) { requestComposedPreview(); renderEditChrome(); }
    return true;
  }
  return false;
}

/** Copy the selected group, or the copy tool's region. */
function editCopy(d) {
  var sel = null;
  var name = '';
  var g = _groupSel != null ? editGroupFind(_groupSel) : null;
  if (g) {
    sel = { x1: g.x, y1: g.y, x2: g.x + g.w - 1, y2: g.y + g.h - 1 };
    name = g.name;
  } else if ((d.tool === 'copy' || d.tool === 'move') && _editSel) {
    sel = _editSel;
  } else {
    return false; // a selected trigger copies itself
  }
  // A group copies as itself, not with the floor it happens to sit on.
  var c = g ? editGroupConstruct(_mtPalette, g)
    : editBuildConstruct(_mtPalette, sel, name || ('pasted ' + (sel.x2 - sel.x1 + 1) + '×' + (sel.y2 - sel.y1 + 1)));
  if (!c) { editNote('nothing painted there to copy'); renderEditChrome(); return true; }
  c.x = sel.x1; c.y = sel.y1;
  // What the preview on the pointer shows: the cells' own stamps.
  c.preview = [];
  for (var y = sel.y1; y <= sel.y2; y++) {
    for (var x = sel.x1; x <= sel.x2; x++) {
      var i = editCellAt(_mtPalette, x, y);
      if (i >= 0) c.preview.push({ dx: x - sel.x1, dy: y - sel.y1, index: i });
    }
  }
  _regionClip = c;
  if (typeof _triggerClipboard !== 'undefined') _triggerClipboard = null;
  editNote('copied ' + c.w + '×' + c.h + ' — Cmd/Ctrl+V picks it up on the pointer');
  renderEditChrome();
  return true;
}

/** Cmd/Ctrl+V: put the copy on the pointer. */
function editPaste(d) {
  if (!_regionClip) return false;
  if (typeof editDeselectAll === 'function') editDeselectAll();
  var h = _editHover && editInBounds(_mtPalette, _editHover.x, _editHover.y)
    ? _editHover : { x: _regionClip.x + 1, y: _regionClip.y + 1 };
  _pasteFloat = pasteAnchor(h);
  _editSel = null;
  editNote('click to put the ' + _regionClip.w + '×' + _regionClip.h + ' copy down — Escape drops it');
  renderEditChrome();
  return true;
}

/** The top-left for a pointer at `cell`: the copy centred on it, kept on the map. */
function pasteAnchor(cell) {
  var c = _regionClip;
  return {
    x: Math.max(0, Math.min(_mtPalette.widthTiles - c.w, cell.x - Math.floor(c.w / 2))),
    y: Math.max(0, Math.min(_mtPalette.heightTiles - c.h, cell.y - Math.floor(c.h / 2))),
  };
}

/** The pointer moved with a copy on it. */
function editPasteFloatMove(cell) {
  if (!_pasteFloat || !_regionClip || !cell) return;
  var at = pasteAnchor(cell);
  if (at.x === _pasteFloat.x && at.y === _pasteFloat.y) return;
  _pasteFloat = at;
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** A click with a copy on the pointer: put it down where it is shown, as one selected object. */
function editPasteFloatPlace() {
  var at = _pasteFloat;
  _pasteFloat = null;
  var c = _regionClip;
  if (!at || !c) return;
  var got = editStampGroup(_mtPalette, c, at.x, at.y);
  if (got.problems.length) editNote(got.problems.join(' · '));
  else if (!got.writes.length) editNote('nothing to paste there');
  else editNote('pasted ' + c.name + ' — drag it to move it; it stays one object');
  requestComposedPreview();
  renderEditChrome();
}

/** The copy on the pointer: its own tiles, see-through, and its outline. */
function editPasteGhostSvg(palette, composed, origin) {
  if (!_pasteFloat || !_regionClip) return '';
  var c = _regionClip;
  var html = '';
  (c.preview || []).forEach(function (p) {
    var pos = editCellPos(origin, _pasteFloat.x + p.dx, _pasteFloat.y + p.dy);
    html += editStampSvg(palette, composed, p.index, pos.x, pos.y, 'rg-edit-cell rg-paste-ghost');
  });
  var a = editCellPos(origin, _pasteFloat.x, _pasteFloat.y);
  return html + '<rect class="rg-paste-box" x="' + a.x + '" y="' + a.y + '" width="' + (c.w * EDIT_UNITS)
    + '" height="' + (c.h * EDIT_UNITS) + '"/>';
}
