// Ownership: a vanilla (ROM) room in the editor — what makes editing one look
// and behave like editing a custom map (map-editor-rules §7): whether the
// palette in hand is the room's own, the room's objects brought into its
// draft, and its triggers and specials drawn by the editor rather than baked
// into the host's render. Owns _specialByNibble; the rest reads `_edit` and
// `_mtPalette` through their owners.

/**
 * A ROM room in edit mode, not a custom map: its own triggers, objects and
 * specials are drawn by the editor, the way a custom map's are, instead of
 * baked into the host's render (rom-overlay.js's romOverlayFlags).
 */
function editOnRomRoom() { return !!(_edit && _edit.on && !_edit.customKey && !_edit.blank); }
/**
 * Whether the palette in hand is this room's. A custom map's palette is its
 * donor's reshaped into a blank map (map-editor-newroom.js) and keeps the
 * donor's roomId, so a vanilla room also has to refuse one marked custom.
 */
function mtPaletteFits(room) {
  if (!_mtPalette || !room) return false;
  if (room.custom) {
    var m = typeof customFind === 'function' ? customFind(room.custom) : null;
    return !!m && _mtPalette.roomId === m.borrow;
  }
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : room.romRoomId;
  return _mtPalette.roomId === id && !_mtPalette.customBlank;
}

/**
 * A ROM room's own objects, brought into its draft once so the Object tab
 * lists and edits them like drawn ones (`roomObject` is the ROM's index).
 * State 0 is the loaded map; frames are the host's (object-previews.js's
 * editorObjects). Never inside an open undo step: seeding is not an edit,
 * and undoing the first stroke must not take the room's objects with it.
 */
function editSeedRoomObjects() {
  var d = editDraft(), p = _mtPalette;
  if (!d || d.roomObjectsSeeded || d.customKey || d.blank || d.txn) return;
  if (!p || p.customBlank || p.roomId !== d.roomId || !p.roomObjects) return;
  d.roomObjectsSeeded = true;
  p.roomObjects.forEach(function (ro) {
    var frames = ro.frames.map(function (f) { return Object.assign({}, f); });
    d.placed.push({ kind: 'object', uid: editNextPlacedUid(), roomObject: ro.index, x: ro.x, y: ro.y,
      w: ro.w, h: ro.h, states: frames.length + 1, frames: frames, layer: {}, activeFrame: 0,
      holds: (ro.holds || []).slice() });
  });
}

/**
 * The catalog picks a collision word already carries — what a ROM room's own
 * cells show in place of the old baked drift arrows and gate borders, so a
 * vanilla room reads like a custom map. Bit 13 names its nibble's stairs or
 * drift pick (3..7 are all `walkable`); an entity gate names its gate pick.
 * Gate 9 has no effect of its own (§4) and no pick, so it shows nothing.
 */
function editWordSpecialIds(cw) {
  if (!_specialByNibble) {
    _specialByNibble = { drift: {}, gate: {} };
    EDIT_SPECIAL_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.drift != null && !(it.drift in _specialByNibble.drift)) _specialByNibble.drift[it.drift] = it.id;
        if (it.gate != null && !(it.gate in _specialByNibble.gate)) _specialByNibble.gate[it.gate] = it.id;
      });
    });
  }
  var out = [];
  if (cw & 0x2000) {
    var n = cw & 0xf;
    var id = _specialByNibble.drift[n >= 3 && n <= 7 ? 0x4 : n];
    if (id) out.push(id);
  }
  if (cw & 0x100) {
    var gid = _specialByNibble.gate[(cw >> 8) & 0xf];
    if (gid) out.push(gid);
  }
  if (cw & 0x40) out.push('plane-transparent');
  return out;
}
/** Nibble -> catalog id, built once from EDIT_SPECIAL_GROUPS. */
var _specialByNibble = null;

/** Glyphs for the specials a ROM room's cells carry, where nothing else drew one. */
function editRoomSpecialsSvg(palette, origin, d, drawnKeys) {
  var html = '';
  // Per stamp, not per cell: the biggest room is 28000 cells of a few
  // hundred stamps, and this runs on every redraw.
  var byStamp = {};
  for (var y = 0; y < palette.heightTiles; y++) {
    for (var x = 0; x < palette.widthTiles; x++) {
      var k = editKey(x, y);
      if (drawnKeys[k] || Object.prototype.hasOwnProperty.call(d.specialCells || {}, k)) continue;
      var i = editCellAt(palette, x, y);
      var ids = byStamp[i];
      if (!ids) {
        var w = editStampWords(palette, i);
        ids = byStamp[i] = w ? editWordSpecialIds(w.collision) : [];
      }
      if (!ids.length) continue;
      drawnKeys[k] = true;
      var pos = editCellPos(origin, x, y);
      html += editSpecialGlyphSvg(ids, pos.x, pos.y);
    }
  }
  return html;
}
