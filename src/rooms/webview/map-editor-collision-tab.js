// Ownership: the Collision tab — a cell's collision shape set by hand.
//
// A painted tile gets the shape vanilla most often gives its graphic
// (map-editor-collision.js tileSuggestedCollision), written into the stamp.
// This tab overrides that per cell, on a layer of its own (`_edit.coll`,
// "x,y" -> geometry code 0..15), the way the cuttable layer sits over the
// map: the stamp keeps its estimate, so erasing the override brings the
// estimate back. The override is applied only where a collision word leaves
// the editor — the drafted map's collision render and Export ROM
// (romExportPayload), and a vanilla room's handoff (editExport) — and drawn
// on the map here.
//
// An override is a *geometry* code (map_collision_mechanics.md §5), so it
// also clears always-walkable (bit 13): under that bit the low nibble is a
// drift direction, not a shape. Level, gate, see-through and interact bits
// are the cell's own and stay.
//
// Writes go through editApply with `layer: 'coll'`, so they share the one
// undo stack. The Special tab's collision flags stay there: they are flags
// on top of a shape, not shapes.
//
// Owns: _collPick.

/** The armed shape, 0..15, or -1. */
var _collPick = -1;

/**
 * Every code §5 documents, in the tab's order. Six pairs share a solid
 * region and nothing documented tells the two apart, so both are offered,
 * each saying which it twins.
 */
var COLL_CODES = [
  [0x00, 'open'], [0x0f, 'solid'],
  [0x02, 'diagonal SW', 0x06], [0x06, 'diagonal SW', 0x02], [0x01, 'diagonal SE', 0x05], [0x05, 'diagonal SE', 0x01],
  [0x0a, 'diagonal NW', 0x0e], [0x0e, 'diagonal NW', 0x0a], [0x09, 'diagonal NE', 0x0d], [0x0d, 'diagonal NE', 0x09],
  [0x03, 'bottom half', 0x04], [0x04, 'bottom half', 0x03], [0x0c, 'top half', 0x0b], [0x0b, 'top half', 0x0c],
  [0x08, 'right half'], [0x07, 'left half'],
];

/** maps/collision.ts geometryMask, as a test for one pixel: is (px, py) solid? */
function collSolid(code, px, py) {
  if (code === 0x0f) return true;
  if (code === 0x02 || code === 0x06) return py >= px;
  if (code === 0x01 || code === 0x05) return px + py >= 15;
  if (code === 0x0a || code === 0x0e) return px + py <= 15;
  if (code === 0x09 || code === 0x0d) return py <= px;
  if (code === 0x03 || code === 0x04) return py >= 8;
  if (code === 0x0c || code === 0x0b) return py < 8;
  if (code === 0x08) return px >= 8;
  if (code === 0x07) return px < 8;
  return false;
}

/** The solid pixels of a code as one path in a 16×16 box at (x, y), `s` units per pixel. */
function collMaskPath(code, x, y, s) {
  var d = '';
  for (var py = 0; py < 16; py++) {
    for (var px = 0; px < 16; px++) {
      if (!collSolid(code, px, py)) continue;
      var run = px;
      while (run + 1 < 16 && collSolid(code, run + 1, py)) run++;
      d += 'M' + (x + px * s) + ' ' + (y + py * s) + 'h' + ((run - px + 1) * s) + 'v' + s + 'h' + (-(run - px + 1) * s) + 'z';
      px = run;
    }
  }
  return d;
}

/** The colour "Tile by tile" draws a level in. */
function collLevelColor(level) {
  return typeof LEVEL_COLORS !== 'undefined' ? LEVEL_COLORS[level & 3] : 'rgb(235,25,25)';
}

/** The override at a cell, or -1. */
function editCollisionAt(x, y) {
  var d = editDraft();
  var k = editKey(x, y);
  return d && d.coll && Object.prototype.hasOwnProperty.call(d.coll, k) ? d.coll[k] : -1;
}

/** A collision word with the cell's override applied (unchanged without one). */
function editCollisionApplied(x, y, cw) {
  var code = editCollisionAt(x, y);
  return code < 0 ? cw : (cw & ~0x200f) | code;
}

/** Every override, for a vanilla room's handoff: `[{x, y, geometry}]`. */
function editCollisionPayload() {
  var d = editDraft();
  return Object.keys((d && d.coll) || {}).map(function (k) {
    var p = k.split(',');
    return { x: Number(p[0]), y: Number(p[1]), geometry: d.coll[k] };
  });
}

/** Arm a shape: the Collision tab's pencil draws it. */
function collPick(code) {
  _collPick = Number(code);
  var d = editDraft();
  if (d && !editLocked()) d.tool = 'paint';
  var def = collCodeDef(_collPick);
  editNote('pencil: collision ' + (def ? def[1] : '') + ' (0x' + _collPick.toString(16) + ') — overrides the tile’s estimate; the eraser takes it off');
  renderEditChrome();
}

function collCodeDef(code) {
  for (var i = 0; i < COLL_CODES.length; i++) if (COLL_CODES[i][0] === code) return COLL_CODES[i];
  return null;
}

/** The Collision tab's pencil (or eraser) on one cell — one write on the `coll` layer. */
function editCollisionStroke(cell, erasing) {
  if (!erasing && _collPick < 0) return;
  var was = editCollisionAt(cell.x, cell.y);
  if (erasing ? was < 0 : was === _collPick) return;
  editApply([{ x: cell.x, y: cell.y, index: erasing ? null : _collPick, layer: 'coll' }]);
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** A cell's level, off what it shows: overrides are drawn in its colour. */
function collCellLevel(x, y) {
  var i = typeof editCellAt === 'function' ? editCellAt(_mtPalette, x, y) : -1;
  var w = i >= 0 ? editStampWords(_mtPalette, i) : null;
  return w ? (w.collision >> 4) & 3 : (typeof editLevel === 'function' ? editLevel() : 1);
}

/** The overrides on the map, while the tab is open or the Collision overlay is on. */
function editCollisionOverlaySvg(origin) {
  var d = editDraft();
  if (!d || !d.coll) return '';
  var showing = (typeof _editActiveTab !== 'undefined' && _editActiveTab === 'collision')
    || (typeof collisionOn === 'function' && collisionOn());
  if (!showing) return '';
  var s = EDIT_UNITS / 16;
  var html = '';
  Object.keys(d.coll).forEach(function (k) {
    var p = k.split(','), x = Number(p[0]), y = Number(p[1]);
    if (!editInBounds(_mtPalette, x, y)) return;
    var a = editCellPos(origin, x, y);
    var col = collLevelColor(collCellLevel(x, y));
    html += '<g class="rg-coll-override"><path d="' + collMaskPath(d.coll[k], a.x, a.y, s) + '" fill="' + col + '" fill-opacity=".55"/>'
      + '<rect x="' + (a.x + 0.05) + '" y="' + (a.y + 0.05) + '" width="' + (EDIT_UNITS - 0.1) + '" height="' + (EDIT_UNITS - 0.1)
      + '" fill="none" stroke="' + col + '" stroke-width="0.08" stroke-dasharray="0.3 0.2"/>'
      + '<title>collision set by hand: ' + collCodeDef(d.coll[k])[1] + ' (0x' + d.coll[k].toString(16) + ')</title></g>';
  });
  return html;
}

/** A shape's swatch: its solid pixels in the level's colour, as "Tile by tile" draws them. */
function collSwatchSvg(code, color) {
  return '<svg class="rg-coll-swatch" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">'
    + '<rect width="16" height="16" class="rg-coll-swatch-bg"/>'
    + '<path d="' + collMaskPath(code, 0, 0, 1) + '" fill="' + color + '" fill-opacity=".75"/></svg>';
}

/** The tab: every shape, armed the way every tab's pick is. */
function collisionTabHtml() {
  var d = editDraft();
  var color = collLevelColor(typeof editLevel === 'function' ? editLevel() : 1);
  var n = Object.keys((d && d.coll) || {}).length;
  var html = '<div class="rg-special-group"><div class="rg-special-h">Collision shape</div>'
    + '<div class="rs-note">Sets a cell’s shape by hand, over the one its tile was given. The tile keeps its estimate: '
    + 'erase the override and it comes back. Shown in the level’s colour; it clears always-walkable (stairs, drift).'
    + (n ? ' ' + n + ' cell' + (n === 1 ? '' : 's') + ' set by hand.' : '') + '</div>'
    + '<div class="rg-coll-grid">';
  COLL_CODES.forEach(function (c) {
    var on = _collPick === c[0];
    var tip = c[1] + ' — code 0x' + c[0].toString(16)
      + (c[2] != null ? '\nSame solid pixels as 0x' + c[2].toString(16) + '; nothing documented tells the two apart' : '');
    html += '<button class="rdf rg-coll-chip' + (on ? ' on rg-armed' : '') + '" data-coll-pick="' + c[0] + '" title="' + escH(tip) + '">'
      + collSwatchSvg(c[0], color) + '<span class="rg-coll-lbl">' + escH(c[1]) + '<b>0x' + c[0].toString(16) + '</b></span></button>';
  });
  return html + '</div></div>';
}
