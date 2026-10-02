// Ownership: the room's metatile dictionary as the host sends it — the map
// editor's stamps. The sheet that used to be drawn under the map is gone
// (the editor's Tile tab is the picker); this is the request, the reply and
// the state the editor reads.
//
// This is the brush set a map editor would place from: a room's grid stores
// metatile ids, and Block 3 turns each id into a Layer 1 word, a Layer 2
// word and a collision word. Nothing outside the dictionary can be placed
// without extending it. See docs/map-format/map_editor_ui.md.
//
// Owns: _mtPalette (the last palette received), _mtLayer, _mtSelected,
// _mtSlot, _mtBgPalette.
//
// Depends on: utils.js (escH), detail-renderer.js (roomVanillaIdNum).

var _mtPalette = null;
var _mtLayer = 'composite';
var _mtSelected = -1;
var _mtBgPalette = 1;     // which tile family the tile sheet is drawn in
var _mtSlot = -1;         // the selected graphic, in the tiles view
var _mtRoomId = null;
var _mtRoomName = '';

/** Ask the host for the dictionary of the room currently on screen. */
function requestMetatilePalette(room, layer) {
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : null;
  if (id == null || typeof vs === 'undefined' || !vs) return;
  // A selection is an index into one room's dictionary; it means something
  // else in the next room.
  if (_mtRoomId !== id) { _mtSelected = -1; _mtSlot = -1; }
  _mtRoomId = id;
  _mtRoomName = room && room.name;
  _mtLayer = layer || _mtLayer;
  vs.postMessage({ command: 'requestRoomMetatiles', roomId: id, mapName: _mtRoomName,
                   layer: _mtLayer, bgPalette: _mtBgPalette,
                   header: typeof infoRenderHeader === 'function' ? infoRenderHeader(id) : null });
}

/** Host reply: keep it and draw. */
function applyMetatilePalette(msg) {
  if (!msg || msg.roomId !== _mtRoomId) return;
  if (msg.error) { if (typeof editNote === 'function') editNote(msg.error); return; }
  // A header edit (map-editor-info.js) redraws the stamps' pictures and nothing else:
  // the palette in hand may be a custom map's own (its grid, size and families).
  if (msg.atlasOnly) {
    if (_mtPalette && msg.palette) {
      _mtPalette.imageUri = msg.palette.imageUri;
      if (typeof renderEditLayer === 'function') renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    }
    return;
  }
  _mtPalette = msg.palette;
  if (_mtPalette && _mtPalette.roomId == null && msg.roomId != null) _mtPalette.roomId = msg.roomId;
  // vanilla[] rows are [family, %, alts, collision, %, canopyUses, terrainUses]
  // and the tile sheet's slots are parallel to the room's graphics list.
  if (typeof noteLayerHints === 'function' && msg.palette.vanilla && msg.palette.tiles) {
    var rows = [];
    for (var i = 0; i < msg.palette.tiles.count; i++) {
      var v = msg.palette.vanilla[i];
      if (v) rows.push([0, 0, msg.palette.tiles.slots[i][2], 0, v[5], v[6]]);
    }
    noteLayerHints(rows, 4, 5, 2);
  }
  // A ROM room's objects join its draft now that they are known.
  // The dock was drawn while this was on its way, so it still says
  // "loading the tile palette…" until something redraws it — do that here.
  // Not for a custom map: newMapPaletteReady turns this palette into the
  // map's own first, and redraws then.
  var d = typeof editDraft === 'function' ? editDraft() : null;
  if (d && !d.customKey && typeof editSeedRoomObjects === 'function') {
    editSeedRoomObjects();
    if (typeof editSeedRoomAnims === 'function') editSeedRoomAnims(_mtPalette);
    if (d.on && typeof renderEditChrome === 'function') renderEditChrome();
  }
  // `new map` cannot draft anything until the dictionary it borrows from is
  // in hand, so it waits here rather than racing the request.
  if (typeof newMapPaletteReady === 'function') newMapPaletteReady();
  if (typeof customCopyMapReady === 'function') customCopyMapReady();
}

function hex4(v) { return (v >>> 0).toString(16).toUpperCase().padStart(4, '0'); }
