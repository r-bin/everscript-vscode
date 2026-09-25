// Ownership: the smart eyedropper — a click on the map picks up what is
// there *with the tab, the tool and the settings that draw it*:
//
//   the Boy      -> Special tab, the Boy pick armed (pencil moves him)
//   a trigger    -> Trigger tab, its kind armed, the trigger selected
//   a special    -> Special tab, that special armed, pencil
//   a tile       -> Tile tab, that exact stamp armed, its swatch highlighted
//                   and scrolled into view, H/V and the level set from it
//                   (the cuttable tile, while Cuttable is on)
//
// What the open tab draws wins where the cell has one (a special on the
// Special tab, a trigger on the Trigger tab); otherwise the order above,
// with the tile before a trigger — a room-wide trigger box covers most
// cells, and the tile is what a click on the floor means.

function editSmartPick(cell) {
  var d = editDraft();
  if (!d) return;
  var tab = typeof _editActiveTab !== 'undefined' ? _editActiveTab : 'tile';
  if (typeof startHit === 'function' && startHit(cell)) return pickBoy(d);
  var special = editSpecialAt(cell.x, cell.y);
  var trigger = editTriggerAt(cell.x, cell.y);
  if (tab === 'special' && special) return pickSpecial(d, special);
  if (tab === 'trigger' && trigger) return pickTrigger(d, trigger);
  if (special) return pickSpecial(d, special);
  if (pickTile(d, cell)) return;
  if (trigger) return pickTrigger(d, trigger);
  editNote('nothing to pick up there');
  renderEditChrome();
}

function pickGo(d, tab, tool) {
  editDeselectAll();
  _editActiveTab = tab;
  d.tool = tool;
}

function pickBoy(d) {
  pickGo(d, 'special', 'paint');
  d.currentSpecialId = START_SPECIAL_ID;
  editNote('picked the Boy — drag him on the map to move him');
  renderEditChrome();
}

function pickSpecial(d, id) {
  pickGo(d, 'special', 'paint');
  d.currentSpecialId = id;
  var def = editSpecialById(id);
  editNote('picked ' + (def ? def.label : id) + ' — the pencil draws it');
  renderEditChrome();
}

function pickTrigger(d, ref) {
  pickGo(d, 'trigger', 'paint');
  _editTriggerKind = ref.kind;
  d.selectedTriggerRef = ref;
  editNote('picked a ' + (ref.kind === 'b' ? 'B-trigger' : 'step trigger') + ' — the pencil draws this kind');
  renderEditChrome();
}

/** Arm the cell's own stamp, and point the Tile tab at the swatch it is drawn with. */
function pickTile(d, cell) {
  var cutOn = typeof editCutLayerOn === 'function' && editCutLayerOn();
  var idx = cutOn && editCutAt(cell.x, cell.y) >= 0 ? editCutAt(cell.x, cell.y) : editCellAt(_mtPalette, cell.x, cell.y);
  var w = idx >= 0 ? editStampWords(_mtPalette, idx) : null;
  if (!w) return false;
  var front = w.layer1 !== editBlankCanopy(_mtPalette);
  var word = front ? w.layer1 : w.layer2;
  var chr = word & 0x3ff;
  var graphic = editGraphicAtSlot(_mtPalette, Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2));
  var pal = (word >> 10) & 0x07;
  var family = pal >= 1 ? editFamilies()[pal - 1] : undefined;
  pickGo(d, 'tile', 'paint');
  if (typeof editArmBrush === 'function') editArmBrush();
  d.brush = idx;
  _mtSelected = idx;
  _brushTile = graphic !== undefined && family !== undefined ? { graphic: graphic, family: family } : null;
  _brushFlip = { h: !!(word & 0x4000), v: !!(word & 0x8000) };
  d.plane = (w.collision >> 4) & 3;
  editNote('picked stamp #' + idx + (graphic !== undefined ? ' — graphic ' + graphic : '')
    + (family !== undefined ? ' in family ' + family : '') + ', ' + (front ? 'front' : 'ground')
    + ', level ' + d.plane + '. The pencil draws it.');
  renderEditChrome();
  if (_brushTile) pickRevealSwatch(_brushTile);
  return true;
}

/** Scroll the Tile tab to the swatch (or, until its sheet loads, its family). */
function pickRevealSwatch(t) {
  var box = document.getElementById('rg-tile-scroll') || document.getElementById('rg-tab-body');
  if (!box) return;
  var el = box.querySelector('[data-fam-tile="' + t.graphic + '"][data-fam-of="' + t.family + '"]')
    || box.querySelector('[data-group-fam="' + t.family + '"]');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  if (typeof ensureFamilySheet === 'function') ensureFamilySheet(t.family);
}
