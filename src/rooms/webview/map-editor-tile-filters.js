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
// - `anim | frames`: an animation (Section 2, maps/vanilla-animation.ts) is
//   one swatch that plays its frames — its later frames are never placed on
//   their own — or, with `frames`, every frame is its own swatch. Slot rows
//   [13..15]: kind (1 first frame, 2 later frame), frame 0, frame number.
//
// They combine. A family with nothing to show is left out without
// fetching its sheet: the catalogue carries every count (room-draft.js).
//
// Split out of map-editor-tiles.js (400-line limit).
//
// Owns: _tileFilter, _tileShape, _tileFramesSplit.

var _tileFilter = null;
/** null = all, or 'floor' | 'edge' | 'wall'. */
var _tileShape = null;
/** false (the default): an animation is one swatch. true: each frame is. */
var _tileFramesSplit = false;

function tileFramesPick(which) {
  _tileFramesSplit = which === 'frames';
  renderEditPanels();
}

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
  // Combining frames never hides a whole family: only the two list filters do.
  if (!_tileFilter && !_tileShape) return true;
  return tileFamilyCount(family) > 0;
}

/** How many tiles of a family the filters list, from the catalogue (an upper bound); 0 if unknown. */
function tileFamilyCount(family) {
  var meta = chipMeta(family);
  if (!meta) return 0;
  var n = _tileFilter === 'grass' ? meta.grass || 0
    : _tileFilter === 'stairs' ? meta.stairs || 0
    : _tileFilter === 'drift' ? meta.drift || 0
    : _tileFilter === 'deflect' ? meta.deflect || 0
    : _tileFilter === 'interact' ? meta.interact || 0
    : _tileFilter === 'unused' ? meta.unused || 0
    : _tileFilter === 'canopy' ? meta.canopy || 0
    : _tileFilter === 'dual' ? meta.dual || 0
    : meta.tiles - (_tileFramesSplit ? 0 : meta.frames || 0);
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
  if (_tileFilter === 'drift' && !(slot[16] & 1)) return false;
  if (_tileFilter === 'deflect' && !(slot[16] & 2)) return false;
  if (_tileFilter === 'interact' && !(slot[16] & 4)) return false;
  var catFlags = (slot.length > 17 ? slot[17] : 0) || ((slot[16] || 0) >> 8);
  if (_tileFilter === 'unused' && !(catFlags & 1 || (slot[3] === 0 && !slot[10]))) return false;
  if (_tileFilter === 'canopy' && !(catFlags & 2 || (slot[4] > slot[5]))) return false;
  if (_tileFilter === 'dual' && !(catFlags & 4)) return false;
  if (_tileShape && tileShapeClass(slot) !== _tileShape) return false;
  if (!_tileFramesSplit && slot[13] === 2) return false;
  return true;
}

/**
 * The swatch's animation mark: on an animation, the letter of the pattern a
 * pick places (this family's most-used, map-editor-animations.js); `k/n` on
 * a frame listed on its own.
 */
function tileAnimMarkHtml(sheet, slot) {
  var kind = slot[13];
  if (!kind) return '';
  var a = sheet && sheet.animations && sheet.animations[slot[14]];
  var n = a ? a.frames.length : 0;
  // Listed frame by frame, the first frame is frame 1 of n like the others.
  var text = kind === 1 && !_tileFramesSplit ? (a && typeof ANIM_LETTERS !== 'undefined' ? ANIM_LETTERS[a.pick || 0] : '▶')
    : (kind === 1 ? 1 : slot[15] + 1) + (n ? '/' + n : '');
  return '<b class="rg-anim-mark' + (kind === 2 ? ' later' : '') + '" aria-hidden="true">' + text + '</b>';
}

function tileAnimTitle(sheet, slot) {
  var a = sheet && sheet.animations && sheet.animations[slot[14]];
  var n = a ? a.frames.length : 0;
  if (slot[13] === 1 && _tileFramesSplit) return '\nframe 1' + (n ? ' of ' + n : '') + ' — the frame the game places; it plays the rest in place';
  if (slot[13] === 1) return '\nanimation: ' + n + ' frames, played in place by the game — its frames are never placed on their own';
  if (slot[13] === 2) return '\nframe ' + (slot[15] + 1) + (n ? ' of ' + n : '') + ' of the animation starting at graphic ' + slot[14];
  return '';
}

/**
 * A combined animation's swatch plays its frames, at vanilla's timing
 * (delays are 60 Hz ticks): one `@keyframes` per animation, stepping the
 * swatch's background to each frame's place in the sheet. Frames the sheet
 * does not hold are skipped. `{css, style}`, both empty when it does not play.
 */
function tileAnimPlay(sheet, slot) {
  if (_tileFramesSplit || slot[13] !== 1) return { css: '', style: '' };
  var a = sheet.animations && sheet.animations[slot[2]];
  if (!a) return { css: '', style: '' };
  var steps = [];
  var total = 0;
  a.frames.forEach(function (g, i) {
    var at = -1;
    for (var k = 0; k < sheet.slots.length; k++) if (sheet.slots[k][2] === g) { at = k; break; }
    if (at < 0) return;
    steps.push({ at: at, from: total });
    total += Math.max(1, a.delays[i] || 1);
  });
  if (steps.length < 2) return { css: '', style: '' };
  var name = 'rg-anim-' + sheet.family + '-' + slot[2];
  var css = '@keyframes ' + name + '{';
  steps.forEach(function (st) {
    css += (100 * st.from / total).toFixed(2) + '%{background-position:-' + ((st.at % sheet.columns) * sheet.cell)
      + 'px -' + (Math.floor(st.at / sheet.columns) * sheet.cell) + 'px}';
  });
  css += '}';
  return { css: css, style: 'animation:' + name + ' ' + (total / 60).toFixed(3) + 's steps(1,end) infinite;' };
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
    + tileSegHtml('tile-frames', [
      ['anim', 'anim', 'An animation is one swatch that plays its frames — the game only ever places its '
        + 'first frame and plays the rest in place'],
      ['frames', 'frames', 'Every animation frame as its own swatch'],
    ], function (v) { return (_tileFramesSplit ? 'frames' : 'anim') === v; })
    + tileSegHtml('tile-filter', [
      ['grass', 'cuttable', 'Show only tiles that are part of cuttable grass — the uncut tile, '
        + 'or what it turns into when cut. Off: every tile.'],
      ['stairs', 'stairs', 'Show only tiles vanilla draws as stairs. Painting one gives it the stairs '
        + 'flag (always-walkable, keeps the level), mirrored with H. Off: every tile.'],
      ['drift', 'drift', 'Show only conveyor drift tiles (water currents, conveyor belts, quicksand, pipes). Off: every tile.'],
      ['deflect', 'deflect', 'Show only tiles vanilla mostly gives the Deflect gate (bit 8, nibble 1 — the Special tab’s Deflect). Off: every tile.'],
      ['interact', 'interaction', 'Show only interactive object tiles (containers, sniff spots, switches — bit 15 set). Off: every tile.'],
      ['unused', 'unused', 'Show only unused tiles (never placed in any vanilla room grid). Off: every tile.'],
      ['canopy', 'canopy', 'Show only canopy tiles (drawn in the front/canopy layer over characters). Off: every tile.'],
      ['dual', '2-layer', 'Show only tiles that need 2 layers with no canopy to look complete (dual-layer ground). Off: every tile.'],
    ], function (v) { return _tileFilter === v; })
    + '</div>';
}
