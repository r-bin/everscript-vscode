// Ownership: the two trigger bits of a collision word, as overlays and as
// per-cell state — bit 15 (Interact: B searches the B-triggers, `$8FCE43`) and
// bit 14 (Step-on: the step-on table is only searched over these cells,
// `$8FB07B`, map_collision_mechanics.md §7.1–§7.2). Each has a toggle in the
// filter bar's Special menu and Force 1 / Force 0 picks on the Special tab
// (map-editor-special.js, which also draws the symbols: editCellSymbols).
//
// Owns: _interactOverlayOn, _stepOnOverlayOn.

var _interactOverlayOn = false, _stepOnOverlayOn = false;
function interactOverlayOn() { return _interactOverlayOn; }
function stepOnOverlayOn() { return _stepOnOverlayOn; }

/** Either overlay is on: the map draws the flag cells (map-editor-paint.js). */
function flagOverlaysOn() { return _interactOverlayOn || _stepOnOverlayOn; }

function flagOverlayRedraw(cls, on, note) {
  var btns = document.querySelectorAll('.' + cls);
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', on);
  if (typeof editNote === 'function') editNote(note);
  if (typeof renderEditChrome === 'function') renderEditChrome();
  var p = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
  if (typeof renderEditLayer === 'function' && p) renderEditLayer(p, typeof _editComposed !== 'undefined' ? _editComposed : null, typeof _editOrigin !== 'undefined' ? _editOrigin : { x: 0, y: 0 });
}

function editInteractToggle() {
  _interactOverlayOn = !_interactOverlayOn;
  flagOverlayRedraw('rdf-interact', _interactOverlayOn,
    _interactOverlayOn ? 'Interact overlay ON — showing Bit 15 states (forced 0, forced 1, 1)' : 'Interact overlay OFF');
}

function editStepOnToggle() {
  _stepOnOverlayOn = !_stepOnOverlayOn;
  flagOverlayRedraw('rdf-stepon', _stepOnOverlayOn,
    _stepOnOverlayOn ? 'Step-on overlay ON — S marks the cells a step-on trigger can fire on (Bit 14)' : 'Step-on overlay OFF');
}

/** True when a trigger box of `kind` ('b' or 'step') covers cell (x, y). */
function editTriggerCovers(kind, x, y) {
  if (typeof editTriggerList !== 'function') return false;
  var list = editTriggerList(kind);
  for (var i = 0; list && i < list.length; i++) {
    var t = list[i];
    if (x >= t.x1 && x <= t.x2 && y >= t.y1 && y <= t.y2) return true;
  }
  return false;
}

function editHasBTriggerAt(x, y) { return editTriggerCovers('b', x, y); }

/** The collision word the cell shows now, or null. */
function editCellCollisionWord(palette, x, y) {
  var p = palette || (typeof _mtPalette !== 'undefined' ? _mtPalette : null);
  var idx = typeof editCellAt === 'function' && p ? editCellAt(p, x, y) : -1;
  if (idx < 0 || typeof editStampWords !== 'function') return null;
  var w = editStampWords(p, idx);
  return w ? w.collision : null;
}

/**
 * A flag bit's state at (x, y): 'forced 1' / 'forced 0' when the Special tab
 * set it, '1' when the cell's word has it or a trigger of `kind` covers the
 * cell, else '0'.
 */
function editCellFlagState(palette, x, y, prefix, mask, kind) {
  var list = editSpecialsAt(x, y);
  if (list.indexOf(prefix + '-force-1') >= 0) return 'forced 1';
  if (list.indexOf(prefix + '-force-0') >= 0) return 'forced 0';
  if (editTriggerCovers(kind, x, y)) return '1';
  var c = editCellCollisionWord(palette, x, y);
  return c != null && (c & mask) ? '1' : '0';
}

function editCellInteractState(palette, x, y) { return editCellFlagState(palette, x, y, 'interact', 0x8000, 'b'); }
function editCellStepOnState(palette, x, y) { return editCellFlagState(palette, x, y, 'stepon', 0x4000, 'step'); }

/** Every cell with a symbol to show while an overlay is on. */
function flagOverlaySvg(palette, origin, drawnKeys) {
  var p = palette || (typeof _mtPalette !== 'undefined' ? _mtPalette : null);
  if (!p || !p.widthTiles || !p.heightTiles) return '';
  var w = p.widthTiles, h = p.heightTiles;
  var html = '<g id="rg-interact-overlay" pointer-events="none">';
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (drawnKeys && drawnKeys[x + ',' + y]) continue;
      var syms = editCellSymbols(p, x, y, []);
      if (!syms.length) continue;
      var pos = typeof editCellPos === 'function' ? editCellPos(origin, x, y) : { x: x * EDIT_UNITS, y: y * EDIT_UNITS };
      html += editRenderSpecialBoxSvg(syms, pos, 'rg-interact-cell', true);
    }
  }
  return html + '</g>';
}

/**
 * Step-on boxes with no bit-14 cell under them: they can never fire by being
 * walked onto (map_collision_mechanics.md §7.2). For the Map sub-tab's checks.
 */
function editDeadStepTriggers(palette) {
  if (typeof editTriggerList !== 'function') return [];
  return editTriggerList('step').filter(function (t) {
    for (var y = t.y1; y <= t.y2; y++) {
      for (var x = t.x1; x <= t.x2; x++) {
        var c = editCellCollisionWord(palette, x, y);
        if (c != null && (c & 0x4000)) return false;
      }
    }
    return true;
  });
}
