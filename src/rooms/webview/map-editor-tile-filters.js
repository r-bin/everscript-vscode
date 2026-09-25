// Ownership: the Tile tab's filter row — which layer a pick lands on, its
// mirror, and the two list filters:
//
// - `cuttable | stairs` (one at a time): graphics that take part in cuttable
//   grass (slot row [10], maps/vanilla-index.ts `grass`) or that vanilla
//   draws as stairs (rows [11]/[12], maps/vanilla-stairs.ts);
// - `all | floor | edge | wall`: by the collision a tile would be painted
//   with (map-editor-collision.js) — floor is open (stairs too), wall fully
//   solid, edge everything between (half tiles, diagonals). What to build a
//   room's floor, walls and the filler between them with. A tile vanilla
//   never drew on that layer has no suggestion and shows only under `all`.
//
// The two combine. A family with nothing to show is left out without
// fetching its sheet: the catalogue carries every count (room-draft.js).
//
// Split out of map-editor-tiles.js (400-line limit).
//
// Owns: _tileFilter, _tileShape.

var _tileFilter = null;
/** null = all, or 'floor' | 'edge' | 'wall'. */
var _tileShape = null;

/** Turn a filter on, or off when it is the one already on. */
function tileFilterToggle(which) {
  _tileFilter = _tileFilter === which ? null : which;
  renderEditPanels();
}

function tileShapePick(which) {
  _tileShape = which === 'all' ? null : which;
  renderEditPanels();
}

/** A catalogue family the filters keep. */
function tileFamilyPasses(family) {
  if (!_tileFilter && !_tileShape) return true;
  return tileFamilyCount(family) > 0;
}

/** How many tiles of a family the filters list, from the catalogue (an upper bound); 0 if unknown. */
function tileFamilyCount(family) {
  var meta = chipMeta(family);
  if (!meta) return 0;
  var n = _tileFilter === 'grass' ? meta.grass || 0 : _tileFilter === 'stairs' ? meta.stairs || 0 : meta.tiles;
  if (_tileShape) n = Math.min(n, (meta.shapes && meta.shapes[_tileShape]) || 0);
  return n;
}

/** The collision class a slot would be painted with: 'floor', 'edge', 'wall', or null. */
function tileShapeClass(slot) {
  var layer = tilePaintLayer(slot[2]);
  if (tileStairsFor(slot, layer, 0)) return 'floor';
  var c = tileCollisionFor(slot, layer);
  if (!c) return null;
  return c.shape === 0 ? 'floor' : c.shape === 0x0f ? 'wall' : 'edge';
}

/** A family-sheet slot the filters keep. */
function tileSlotPasses(slot) {
  if (_tileFilter === 'grass' && !slot[10]) return false;
  if (_tileFilter === 'stairs' && !(slot[11] || slot[12])) return false;
  if (_tileShape && tileShapeClass(slot) !== _tileShape) return false;
  return true;
}

/**
 * The filter row. The mock draws two pills; the layer/mirror pair is those,
 * and the list filters follow. "All families" is the lazy list itself, not
 * a button — see the plan doc §8a.
 */
function tileFilterRowHtml() {
  return '<div class="rg-tile-seg-row">'
    + tileSegHtml('layer-force', [
      ['auto', 'auto', 'Put each tile on the layer vanilla draws it on'],
      ['canopy', 'front', 'Draw every picked tile over whatever it lands on'],
      ['terrain', 'ground', 'Draw every picked tile as the ground'],
    ], function (v) { return (_layerForce || 'auto') === v; })
    + tileSegHtml('brush-flip', [
      ['h', 'H', 'Mirror the picked tile left-to-right (bit 14 of its word).\n'
        + 'A mirrored tile is one more dictionary entry and no extra graphic.'],
      ['v', 'V', 'Mirror the picked tile top-to-bottom (bit 15 of its word).\n'
        + 'A mirrored tile is one more dictionary entry and no extra graphic.'],
    ], function (v) { return !!_brushFlip[v]; })
    + tileSegHtml('tile-shape', [
      ['all', 'all', 'Every tile, whatever its collision'],
      ['floor', 'floor', 'Tiles you can walk on — open, or stairs'],
      ['edge', 'edge', 'Partly solid: half tiles and diagonals — the filler between floor and wall'],
      ['wall', 'wall', 'Fully solid tiles'],
    ], function (v) { return (_tileShape || 'all') === v; })
    + tileSegHtml('tile-filter', [
      ['grass', 'cuttable', 'Show only tiles that are part of cuttable grass — the uncut tile, '
        + 'or what it turns into when cut. Off: every tile.'],
      ['stairs', 'stairs', 'Show only tiles vanilla draws as stairs. Painting one gives it the stairs '
        + 'flag (always-walkable, keeps the level), mirrored with H. Off: every tile.'],
    ], function (v) { return _tileFilter === v; })
    + '</div>';
}
