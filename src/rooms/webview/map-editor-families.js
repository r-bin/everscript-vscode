// Ownership: the seven tile families — which are loaded, and what each one
// would buy. The *chooser* is map-editor-chips.js; this is the state behind
// it and the one action that matters, picking a tile out of a family.
//
// A family is not a palette id to look up, it is a decision about what the
// room can look like. So a slot can be cleared, and picking a *tile* pulls
// its family in behind it rather than the other way round.
//
// Owns: _famCatalogue, _famSheets, _brushTile, _famLayerHint.
//
// See docs/map-format/map-editor-window.md §4.

/** `{id, tiles, rooms, areas, names}` per attested family; null until asked. */
var _famCatalogue = null;
/** familyId -> its rendered sheet, once fetched. */
var _famSheets = {};
/** The graphic+family currently armed as the brush, for the selected ring. */
var _brushTile = null;

/** The families the draft is working with — the room's own until changed. */
function editFamilies() {
  var d = editDraft();
  if (!d) return [];
  if (!d.families) d.families = ((_mtPalette && _mtPalette.tileFamilies) || []).slice(0, 7);
  return d.families;
}

function requestFamilyCatalogue() {
  if (_famCatalogue || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestFamilyCatalogue' });
}

function applyFamilyCatalogue(msg) {
  if (!msg || msg.error || !msg.families) return;
  _famCatalogue = msg.families;
  renderEditPanels();
}

/** Fetch a family's sheet unless it is already in hand. */
function ensureFamilySheet(family) {
  if (family === undefined || _famSheets[family] || typeof vs === 'undefined' || !vs) return;
  _famSheets[family] = 'pending';
  vs.postMessage({ command: 'requestFamilySheet', family: family, borrowFrom: _mtRoomId });
}

function applyFamilySheet(msg) {
  if (!msg || msg.error || !msg.sheet) return;
  _famSheets[msg.sheet.family] = msg.sheet;
  noteLayerHints(msg.sheet.slots, 4, 5, 2);
  renderEditPanels();
}

/** Remember how vanilla splits each graphic between the two layers. */
function noteLayerHints(rows, canopyAt, terrainAt, idAt) {
  if (!rows) return;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r[canopyAt] === undefined) continue;
    _famLayerHint[r[idAt]] = [r[canopyAt], r[terrainAt]];
  }
}

/**
 * Put a family in a slot.
 *
 * Seven is a hard ceiling — the loader clamps to it at `$90D037` — so a
 * slot is *replaced*, never appended past the end.
 */
function editSetFamily(slot, family) {
  var fams = editFamilies();
  if (slot < 0 || slot > 6) return;
  while (fams.length <= slot) fams.push(undefined);
  fams[slot] = family;
  delete editDroppedFamilies()[slot];
  ensureFamilySheet(family);
}

function editClearFamily(slot) {
  var fams = editFamilies();
  if (slot >= 0 && slot < fams.length) {
    // Remembered before it goes, because a tilemap word records the palette
    // *slot*, never the family in it — so a cell left behind can say which
    // slot it needs and nothing else. Without this the invalid-family banner
    // could offer "remove these tiles" and never "put it back".
    if (fams[slot] !== undefined) editDroppedFamilies()[slot] = fams[slot];
    fams[slot] = undefined;
  }
}

/** slot -> the family that used to be there, for as long as the slot is empty. */
function editDroppedFamilies() {
  var d = editDraft();
  if (!d) return {};
  if (!d.droppedFamilies) d.droppedFamilies = {};
  return d.droppedFamilies;
}

/**
 * Bring in the family a graphic needs, and say what it cost.
 *
 * This is "pick a tile, which adds the family". If the family is already
 * in a slot there is nothing to do; if a slot is free it takes the first
 * one; if all seven are taken the tile cannot be drawn as vanilla draws it
 * and the caller is told rather than left with a silent wrong colour.
 */
function editAdoptFamilyFor(graphicSlotOrFamily) {
  var family = graphicSlotOrFamily;
  var fams = editFamilies();
  if (family === undefined || family === null) return { ok: false, why: 'no family known for that tile' };
  if (fams.indexOf(family) >= 0) return { ok: true, added: false, slot: fams.indexOf(family) };
  for (var i = 0; i < 7; i++) {
    if (fams[i] === undefined) {
      editSetFamily(i, family);
      return { ok: true, added: true, slot: i };
    }
  }
  return { ok: false, why: 'all seven palette slots are taken — clear one to make room for family ' + family };
}

/**
 * Pick a tile out of a family's art and make it the brush.
 *
 * Three things have to happen for a graphic the room never loaded: its
 * family needs a palette slot, the graphic needs a Block 1 slot, and the
 * two combine into the word a metatile can name. Each is a budget cost,
 * and each is reported rather than done silently.
 */
function editUseFamilyTile(graphicId, family) {
  var d = editDraft();
  if (!d) return;
  // A tile clicked in the neighbour strip may not have a known family yet.
  if (family === null || family === undefined || isNaN(family)) {
    editNote('graphic ' + graphicId + ' — open the family it belongs to first, '
      + 'so it can be drawn in the right colours');
    return;
  }
  var got = editAdoptFamilyFor(family);
  if (!got.ok) { editNote(got.why); renderEditPanels(); return; }

  var slot = editAdoptGraphic(_mtPalette, graphicId);
  if (slot < 0) { editNote('no tile sheet loaded yet'); return; }
  // The palette field is 1..7 and matches the slot the family sits in; the
  // two mirror bits ride along on top of it (map-editor-tiles.js's
  // `_brushFlip` — geometry, not identity, so the word still names this
  // graphic in this family).
  var word = (editSlotChr(slot) | ((got.slot + 1) << 10) | editBrushFlipBits()) & 0xffff;
  var prefer = _layerForce || editLayerPreference(graphicId);
  var index = editBrushFromTile(_mtPalette, word, d.phase, prefer);

  // Which swatch is armed has to be visible on the swatch, not only in a
  // line of text — clicking with no confirmation reads as a dead control.
  _brushTile = { graphic: graphicId, family: family };
  _mtSlot = -1;
  editArmBrush();

  var flip = (_brushFlip.h ? 'H' : '') + (_brushFlip.v ? 'V' : '');
  editNote('brush: graphic ' + graphicId + ' in family ' + family
    + (flip ? ' mirrored ' + flip : '')
    + (got.added ? ' (family added to slot ' + (got.slot + 1) + ')' : '')
    + ' — stamp #' + index
    + (prefer === 'canopy' ? ', drawn over what it is painted on'
      : prefer === 'terrain' ? ', as ground'
        : d.phase === 'deco' ? ', drawn over what it is painted on' : ', as ground')
    + (_layerForce ? ' (forced)' : prefer ? ' (how vanilla draws it)' : '')
    + '. Paint on the map.');
  requestComposedPreview();
  renderEditChrome();
}

/**
 * Which layer vanilla draws this graphic on, if it is one-sided enough.
 *
 * The host sends the count with each of the room's own graphics; for a
 * graphic picked out of a family sheet it comes with the sheet. Below 60%
 * there is no preference worth overriding the user's phase with.
 */
function editLayerPreference(graphicId) {
  var stats = _famLayerHint[graphicId];
  if (!stats) return null;
  var total = stats[0] + stats[1];
  if (!total) return null;
  var share = Math.max(stats[0], stats[1]) / total;
  if (share < 0.6) return null;
  return stats[0] > stats[1] ? 'canopy' : 'terrain';
}

/** graphic id -> [canopy placements, terrain placements], from the host. */
var _famLayerHint = {};

/**
 * Cells the draft has drawn that no loaded family can colour any more.
 *
 * Removing a family does not silently recolour anything — the word still
 * names palette slot N, and slot N is now empty or something else. So the
 * cells that named it are **stranded**, and the checks panel says so rather
 * than letting the canvas and the ROM disagree.
 */
function editStrandedCells() {
  return editStrandedGroups().reduce(function (all, g) { return all.concat(g.cells); }, []);
}

/**
 * The same cells, grouped by the empty slot they name.
 *
 * `[{slot, family, cells}]`, ordered by slot. `family` is what used to be in
 * that slot (editDroppedFamilies) or `undefined` if this draft never saw it
 * leave — the Tile tab's banner needs the family id to offer a restore, and
 * the *slot* is what the cells actually name, so the restore has to go back
 * into that exact slot to fix anything. See map-editor-stranded.js.
 *
 * Flip bits (14/15) and the priority bit never move the palette field, so
 * a mirrored word is grouped exactly like an unmirrored one.
 */
function editStrandedGroups() {
  var d = editDraft();
  if (!d || !_mtPalette) return [];
  var fams = editFamilies();
  var dropped = editDroppedFamilies();
  var bySlot = {};
  Object.keys(d.cells).sort().forEach(function (key) {
    var w = editStampWords(_mtPalette, d.cells[key]);
    if (!w) return;
    for (var i = 0; i < 2; i++) {
      var pal = ((i ? w.layer2 : w.layer1) >> 10) & 0x07;
      if (pal >= 1 && fams[pal - 1] === undefined) {
        if (!bySlot[pal - 1]) bySlot[pal - 1] = [];
        bySlot[pal - 1].push(key);
        return;
      }
    }
  });
  return Object.keys(bySlot).map(Number).sort(function (a, b) { return a - b; })
    .map(function (slot) { return { slot: slot, family: dropped[slot], cells: bySlot[slot] }; });
}
