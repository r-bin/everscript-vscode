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
  delete editAutoFamilies()[slot]; // chosen by hand now, not by painting
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
    delete editAutoFamilies()[slot];
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
 * The first palette slot with nothing in it, or -1 when all seven are spent.
 *
 * The one question "can another family be adopted?" reduces to, and the
 * reason it is a function rather than `fams.length < 7`: a cleared slot
 * (editClearFamily writes `undefined` in place) leaves a hole in the middle
 * of the array, so the length says nothing useful. `editAdoptFamilyFor`
 * below picks the same slot this reports, and the Tile tab reads it to
 * decide whether showing unadopted candidates is offering something or just
 * noise (map-editor-tiles.js's tileGroupFamilies).
 */
function editFreeFamilySlot() {
  var fams = editFamilies();
  for (var i = 0; i < 7; i++) {
    if (fams[i] === undefined) return i;
  }
  return -1;
}

/**
 * slot -> family, for families that came in by *painting* rather than by
 * hand. Such a slot is derived: it holds its family exactly while some cell
 * on the map names it (editSyncPaintedFamilies). Remembered after the last
 * cell goes, so undoing the erase brings the family back with its cells.
 */
function editAutoFamilies() {
  var d = editDraft();
  if (!d) return {};
  if (!d.autoFamilies) d.autoFamilies = {};
  return d.autoFamilies;
}

/**
 * Which palette slot a family *would* use, without loading it.
 *
 * "Clicking on a tile should not add it to the tile families, only if a
 * tile of the family is on the map." So picking a tile only plans the slot —
 * the brush word has to name one — and records it as a painted family; the
 * slot fills when a cell names it. A free slot no painted family remembers
 * is preferred, so an undo cannot bring back cells into a slot another
 * family has since taken.
 */
function editPlanFamilyFor(family) {
  var fams = editFamilies();
  if (family === undefined || family === null) return { ok: false, why: 'no family known for that tile' };
  if (fams.indexOf(family) >= 0) return { ok: true, added: false, slot: fams.indexOf(family) };
  var auto = editAutoFamilies();
  for (var k in auto) {
    if (auto[k] === family && fams[k] === undefined) return { ok: true, added: true, slot: Number(k) };
  }
  var free = -1;
  for (var i = 0; i < 7; i++) {
    if (fams[i] !== undefined) continue;
    if (free < 0) free = i;
    if (auto[i] === undefined) { free = i; break; }
  }
  if (free < 0) return { ok: false, why: 'all seven palette slots are taken — clear one to make room for family ' + family };
  auto[free] = family;
  ensureFamilySheet(family);
  return { ok: true, added: true, slot: free };
}

/**
 * The palette slot (0-based) a tilemap word draws with, or -1.
 *
 * The empty word draws nothing, so it names no family — even though its
 * palette field says 2 (`$A800`). Counting it made every tile painted on a
 * new map "stranded" in a slot nothing was ever meant to fill.
 */
function editWordFamilySlot(word) {
  var d = editDraft();
  if (word === editBlankCanopy(_mtPalette)) return -1;
  if (d && d.blank && d.blank.floor && (word === d.blank.floor.layer1 || word === d.blank.floor.layer2)) return -1;
  var pal = (word >> 10) & 0x07;
  return pal >= 1 ? pal - 1 : -1;
}

/** The families a preview renders with: loaded ones, plus planned ones, by slot. */
function editPreviewFamilies() {
  var fams = editFamilies();
  var auto = editAutoFamilies();
  var out = [];
  for (var i = 0; i < 7; i++) {
    var f = fams[i] !== undefined ? fams[i] : auto[i];
    out.push(f === undefined ? null : f);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/**
 * Fill or empty each painted family's slot to match the map: loaded while a
 * cell names it, gone when none does. Called after every change to the
 * cells (map-editor.js), so paint, erase, undo and redo all agree.
 */
function editSyncPaintedFamilies() {
  var d = editDraft();
  if (!d || !_mtPalette) return;
  var auto = editAutoFamilies();
  var slots = Object.keys(auto);
  if (!slots.length) return;
  var named = {};
  // The cuttable layer's tiles are on the map too, so they keep a family loaded.
  var placed = Object.keys(d.cells).map(function (k) { return d.cells[k]; })
    .concat(Object.keys(d.cut || {}).map(function (k) { return d.cut[k]; }));
  placed.forEach(function (index) {
    var w = editStampWords(_mtPalette, index);
    if (!w) return;
    var a = editWordFamilySlot(w.layer1);
    var b = editWordFamilySlot(w.layer2);
    if (a >= 0) named[a] = true;
    if (b >= 0) named[b] = true;
  });
  var fams = editFamilies();
  slots.forEach(function (k) {
    var slot = Number(k);
    if (named[slot] && fams[slot] === undefined) {
      while (fams.length <= slot) fams.push(undefined);
      fams[slot] = auto[k];
      ensureFamilySheet(auto[k]);
    } else if (!named[slot] && fams[slot] === auto[k]) {
      fams[slot] = undefined;
    }
  });
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
  var free = editFreeFamilySlot();
  if (free >= 0) {
    editSetFamily(free, family);
    return { ok: true, added: true, slot: free };
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
  // Planned, not loaded: the family joins when one of its tiles is painted.
  var got = editPlanFamilyFor(family);
  if (!got.ok) { editNote(got.why); renderEditPanels(); return; }

  var slot = editAdoptGraphic(_mtPalette, graphicId);
  if (slot < 0) { editNote('no tile sheet loaded yet'); return; }
  // The palette field is 1..7 and matches the slot the family sits in; the
  // two mirror bits ride along on top of it (map-editor-tiles.js's
  // `_brushFlip` — geometry, not identity, so the word still names this
  // graphic in this family).
  var word = (editSlotChr(slot) | ((got.slot + 1) << 10) | editBrushFlipBits()) & 0xffff;
  var prefer = _layerForce || editLayerPreference(graphicId);
  // The collision vanilla gives this graphic on that layer — its shape,
  // on plane 0 (map-editor-collision.js). Open when vanilla never drew it.
  var sheet = _famSheets[family];
  var row = null;
  if (sheet && sheet.slots) for (var r = 0; r < sheet.slots.length; r++) if (sheet.slots[r][2] === graphicId) { row = sheet.slots[r]; break; }
  var collision = typeof tileSuggestedCollision === 'function'
    ? tileSuggestedCollision(row, prefer === 'canopy' ? 'canopy' : 'terrain') : null;
  var index = editBrushFromTile(_mtPalette, word, prefer, collision);

  // Which swatch is armed has to be visible on the swatch, not only in a
  // line of text — clicking with no confirmation reads as a dead control.
  _brushTile = { graphic: graphicId, family: family };
  _mtSlot = -1;
  editArmBrush();

  var flip = (_brushFlip.h ? 'H' : '') + (_brushFlip.v ? 'V' : '');
  editNote('brush: graphic ' + graphicId + ' in family ' + family
    + (flip ? ' mirrored ' + flip : '')
    + (got.added ? ' (family joins slot ' + (got.slot + 1) + ' when painted)' : '')
    + ' — stamp #' + index
    // No phase to fall back to as of §8a.2: with no preference at all this
    // is a ground pick — editBrushFromTile's own documented default.
    + (prefer === 'canopy' ? ', drawn over what it is painted on' : ', as ground')
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
      var slot = editWordFamilySlot(i ? w.layer2 : w.layer1);
      if (slot >= 0 && fams[slot] === undefined) {
        if (!bySlot[slot]) bySlot[slot] = [];
        bySlot[slot].push(key);
        return;
      }
    }
  });
  return Object.keys(bySlot).map(Number).sort(function (a, b) { return a - b; })
    .map(function (slot) { return { slot: slot, family: dropped[slot], cells: bySlot[slot] }; });
}
