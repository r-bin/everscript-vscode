// Ownership: selecting and moving a cell's specials with the Select tool,
// while the Special tab is open.
//
// A cell's specials are its glyph (`specialCells`) and the special bits of
// its collision word: an active entity gate (bits 11..8, nibble 3/5/7) and
// bit 13 with its nibble (drift and stairs) — map-editor-special.js. A
// stairs tile painted from the Tile tab has the bits and no glyph; it moves
// the same way. A click selects them (highlighted), a drag moves them: the
// source loses exactly those bits, the target gets them over its own word
// (its level and shape kept), and the glyph goes along. One undo step, the
// gesture's own.
//
// Owns: _specialSel ({x, y} or null), _specialDrag.

var _specialSel = null;
/** `{x, y}`: where a drag would drop the selection. */
var _specialDrag = null;

var SPECIAL_GATES = [3, 5, 7];

/** `{mask, bits, glyph}` of a cell's specials, or null when it has none. */
function specialBitsAt(x, y) {
  var idx = editCellAt(_mtPalette, x, y);
  var w = idx >= 0 ? editStampWords(_mtPalette, idx) : null;
  var cw = w ? w.collision : 0;
  var mask = 0;
  if (SPECIAL_GATES.indexOf((cw >> 8) & 0xf) >= 0) mask |= 0x0f00;
  if (cw & 0x2000) mask |= 0x200f;
  var glyph = editSpecialAt(x, y);
  if (glyph && (glyph === 'interact-force-1' || glyph === 'interact-force-0')) mask |= 0x8000;
  if (glyph && (glyph === 'stepon-force-1' || glyph === 'stepon-force-0')) mask |= 0x4000;
  if (!mask && !glyph) return null;
  return { mask: mask, bits: cw & mask, glyph: glyph };
}

/** The Select tool on the Special tab. Returns true when the gesture was a special's. */
function specialSelectGesture(cell, phase) {
  if (phase === 'down') {
    var has = specialBitsAt(cell.x, cell.y);
    if (!has) { _specialSel = null; _specialDrag = null; return false; }
    editDeselectAll();
    _specialSel = { x: cell.x, y: cell.y };
    _specialDrag = { x: cell.x, y: cell.y };
    editNote('special selected' + (has.glyph ? ' (' + has.glyph + ')' : '') + ' — drag it to another tile');
    renderEditChrome();
    return true;
  }
  if (!_specialDrag || !_specialSel) return false;
  _specialDrag = { x: cell.x, y: cell.y };
  if (phase === 'move') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return true; }
  var to = _specialDrag;
  _specialDrag = null;
  if (to.x !== _specialSel.x || to.y !== _specialSel.y) {
    if (editMoveSpecial(_specialSel, to)) _specialSel = { x: to.x, y: to.y };
  }
  renderEditChrome();
  return true;
}

/** Move a cell's specials onto another cell. False when there is nothing to move or nowhere to put it. */
function editMoveSpecial(from, to) {
  var has = specialBitsAt(from.x, from.y);
  var target = editCellAt(_mtPalette, to.x, to.y);
  var tw = target >= 0 ? editStampWords(_mtPalette, target) : null;
  if (!has || !tw) { editNote('there is no tile there to carry it'); return false; }
  var writes = [];
  var src = editSpecialAppliedIndex(_mtPalette, editCellAt(_mtPalette, from.x, from.y), null, true);
  if (src !== editCellAt(_mtPalette, from.x, from.y)) writes.push({ x: from.x, y: from.y, index: src });
  var cw = (tw.collision & ~has.mask) | has.bits;
  if (cw !== tw.collision) {
    writes.push({ x: to.x, y: to.y, index: editAddStamp(_mtPalette, { layer1: tw.layer1, layer2: tw.layer2, collision: cw }) });
  }
  editApply(writes, [{ x: from.x, y: from.y, id: null }, { x: to.x, y: to.y, id: has.glyph }]);
  requestComposedPreview();
  editNote('special moved to ' + to.x + ',' + to.y);
  return true;
}

/** The selection, and where a drag would drop it. */
function editSpecialSelSvg(origin) {
  if (!_specialSel) return '';
  var a = editCellPos(origin, _specialSel.x, _specialSel.y);
  var html = '<rect class="rg-special-sel" x="' + a.x + '" y="' + a.y + '" width="' + EDIT_UNITS
    + '" height="' + EDIT_UNITS + '"/>';
  if (_specialDrag && (_specialDrag.x !== _specialSel.x || _specialDrag.y !== _specialSel.y)) {
    var b = editCellPos(origin, _specialDrag.x, _specialDrag.y);
    html += '<rect class="rg-special-ghost" x="' + b.x + '" y="' + b.y + '" width="' + EDIT_UNITS
      + '" height="' + EDIT_UNITS + '"/>';
  }
  return html;
}
