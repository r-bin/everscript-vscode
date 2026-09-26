// Ownership: levels — the elevation plane (collision bits 5..4, 0..3) new
// tiles are drawn on, and the vertical bar at the left of the canvas that
// picks it.
//
// The engine treats a tile on another level as solid unless it is
// plane-transparent (docs/map-format/map_collision_mechanics.md §3): that is
// how a bridge and the tunnel beneath it share cells. Level 1 is the
// default because 104 of 127 vanilla rooms use only level 1, and the blank
// floor a custom map starts with is level 1 too. The colours are the
// collision overlay's own (maps/overlay-features.ts PLANE_COLORS), so the
// bar reads the same as the red/blue lines on the map.
//
// State is the draft's `plane` (map-editor.js), saved with the map.

var LEVEL_COLORS = ['rgb(0,170,255)', 'rgb(235,25,25)', 'rgb(0,255,170)', 'rgb(190,90,255)'];
var LEVEL_BITS = 0x30;

function editLevel() {
  var d = editDraft();
  return d && d.plane >= 0 && d.plane <= 3 ? d.plane : 1;
}

/** The bar: levels 3 at the top to 0 at the bottom, the current one lit. */
function buildLevelBarHtml() {
  var cur = editLevel();
  var html = '<div class="rg-level-bar" id="rg-level-bar" role="radiogroup" aria-label="Level">'
    + '<span class="rg-level-h">Level</span>';
  for (var p = 3; p >= 0; p--) {
    html += '<button class="rg-level-b' + (p === cur ? ' on' : '') + '" data-edit-level="' + p + '"'
      + ' style="--lv:' + LEVEL_COLORS[p] + '" role="radio" aria-checked="' + (p === cur) + '"'
      + ' data-tip="' + escH('Level ' + p + (p === 1 ? ' (the usual one)' : '')
        + ' — new tiles are drawn on it. Tiles on another level are walls, unless '
        + 'plane-transparent: that is how bridges pass over tunnels.') + '">' + p + '</button>';
  }
  return html + '</div>';
}

function editLevelPick(p) {
  var d = editDraft();
  if (!d) return;
  p = Number(p);
  if (!(p >= 0 && p <= 3)) return;
  d.plane = p;
  editNote('drawing on level ' + p + (p === 1 ? '' : ' — the Boy walks only where his level is'));
  renderEditChrome();
}

/**
 * The stamp to write for `index` on the current level: the same stamp
 * when it is already there, else one with bits 5..4 changed and the rest
 * of the collision word kept.
 */
function editOnLevel(palette, index, level) {
  if (index == null || index < 0) return index;
  var w = editStampWords(palette, index);
  if (!w) return index;
  var want = (level >= 0 && level <= 3 ? level : editLevel()) << 4;
  if ((w.collision & LEVEL_BITS) === want) return index;
  return editAddStamp(palette, { layer1: w.layer1, layer2: w.layer2, collision: (w.collision & ~LEVEL_BITS) | want });
}

/** The same for a list of writes, leaving removals alone. */
function editWritesOnLevel(palette, writes, level) {
  return (writes || []).map(function (w) {
    return w && w.index != null ? Object.assign({}, w, { index: editOnLevel(palette, w.index, level) }) : w;
  });
}

/**
 * The level of the floor under a stamp's footprint: the one most of the
 * cells it covers already have. A gourd dropped on a level-2 plateau is a
 * level-2 gourd, whatever the bar says — otherwise it would be a wall the
 * Boy on that plateau walks into, and a hole in the plateau for him too.
 * Open ground (nothing there yet) says nothing; with none, the bar decides.
 */
function editFloorLevel(palette, writes) {
  var count = [0, 0, 0, 0];
  var seen = 0;
  (writes || []).forEach(function (w) {
    var i = editCellAt(palette, w.x, w.y);
    var words = i >= 0 ? editStampWords(palette, i) : null;
    if (!words) return;
    count[(words.collision & LEVEL_BITS) >> 4] += 1;
    seen += 1;
  });
  if (!seen) return editLevel();
  var best = 0;
  for (var p = 1; p < 4; p++) if (count[p] > count[best]) best = p;
  return best;
}
