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
// Owns: _regionClip.

/** The copied construct, or null. */
var _regionClip = null;

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
  var c = editBuildConstruct(_mtPalette, sel, name || ('pasted ' + (sel.x2 - sel.x1 + 1) + '×' + (sel.y2 - sel.y1 + 1)));
  if (!c) { editNote('nothing painted there to copy'); renderEditChrome(); return true; }
  c.x = sel.x1; c.y = sel.y1;
  _regionClip = c;
  if (typeof _triggerClipboard !== 'undefined') _triggerClipboard = null;
  editNote('copied ' + c.w + '×' + c.h + ' — Cmd/Ctrl+V pastes it under the pointer');
  renderEditChrome();
  return true;
}

/** Paste the copied region as one selected object, under the pointer. */
function editPaste(d) {
  if (!_regionClip) return false;
  var c = _regionClip;
  var at = _editHover && editInBounds(_mtPalette, _editHover.x, _editHover.y)
    ? { x: _editHover.x, y: _editHover.y } : { x: c.x + 1, y: c.y + 1 };
  at.x = Math.max(0, Math.min(_mtPalette.widthTiles - c.w, at.x));
  at.y = Math.max(0, Math.min(_mtPalette.heightTiles - c.h, at.y));
  if (typeof editDeselectAll === 'function') editDeselectAll();
  var got = editStampGroup(_mtPalette, c, at.x, at.y);
  if (got.problems.length) editNote(got.problems.join(' · '));
  else if (!got.writes.length) editNote('nothing to paste there');
  else editNote('pasted ' + c.name + ' — drag it into place; it stays one object');
  _editSel = null;
  requestComposedPreview();
  renderEditChrome();
  return true;
}
