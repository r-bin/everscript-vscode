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
// Two ways to draw: **Shapes** (pick one of the codes) and **Draw** — freehand
// on the 8px grid. Each 16px cell is four 8px quarters, and the quarters
// drawn name the shape: none open, all solid, two along a side a half
// (`_`), an L of three or a lone corner the 45° diagonal on that side (`L`).
// Two opposite corners name no shape the format has, and are refused.
//
// Owns: _collPick, _collMode, _collSlide, _collVanillaOnly.

/** The armed shape, 0..15, or -1. */
var _collPick = -1;
/** 'shapes' (pick a code) or 'draw' (8px quarters). */
var _collMode = 'shapes';
/** Diagonals drawn freehand take the variant that slides (true) or stops (false). */
var _collSlide = true;
/** Hide the codes no vanilla room places (the filter row). */
var _collVanillaOnly = true;

/**
 * Every code §5 documents, in the tab's order: `[code, label, twin, how]`.
 * Six pairs share a solid region. The diagonal twins are told apart by the
 * engine's per-code tables read after the evaluator ($8FA3F8: which of the
 * eight compass points are open — three for one twin, one for the other;
 * $8FA418: only the three-point twin has an entry there), which reads as a
 * slope you slide along against a wall that stops you — unconfirmed in game.
 * 0x04 and 0x0B are open in both tables and placed in no vanilla room.
 */
var COLL_CODES = [
  [0x00, 'open'], [0x0f, 'solid'],
  [0x02, 'diagonal SW', 0x06, 'slides'], [0x06, 'diagonal SW', 0x02, 'stops'],
  [0x01, 'diagonal SE', 0x05, 'slides'], [0x05, 'diagonal SE', 0x01, 'stops'],
  [0x0e, 'diagonal NW', 0x0a, 'slides'], [0x0a, 'diagonal NW', 0x0e, 'stops'],
  [0x0d, 'diagonal NE', 0x09, 'slides'], [0x09, 'diagonal NE', 0x0d, 'stops'],
  [0x03, 'bottom half', 0x04], [0x04, 'bottom half?', 0x03], [0x0c, 'top half', 0x0b], [0x0b, 'top half?', 0x0c],
  [0x08, 'right half'], [0x07, 'left half'],
];

/** The engine's tables (above), as the twins' tooltips quote them. */
var COLL_HOW = {
  slides: 'Three of the eight compass points around it are open, and the engine has a slide entry for it — reads as a slope you slide along (not confirmed in game).',
  stops: 'Only its corner point is open, and the engine has no slide entry for it — reads as a diagonal wall that stops you (not confirmed in game).',
};

// ── the 8px quarters ────────────────────────────────────────────────────────
// Bits: 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right.

/** The quarters a code fills, as freehand drawing reads a cell (twins alike; 0x04/0x0B are open). */
function collQuarters(code) {
  return ({ 0x0f: 15, 0x0c: 3, 0x03: 12, 0x07: 5, 0x08: 10,
    0x02: 13, 0x06: 13, 0x01: 14, 0x05: 14, 0x0e: 7, 0x0a: 7, 0x0d: 11, 0x09: 11 })[code] || 0;
}

/** The code some quarters name, or -1 when two opposite corners name none. */
function collCodeOfQuarters(q, slide) {
  var diag = { 13: [0x02, 0x06], 4: [0x02, 0x06], 14: [0x01, 0x05], 8: [0x01, 0x05],
    7: [0x0e, 0x0a], 1: [0x0e, 0x0a], 11: [0x0d, 0x09], 2: [0x0d, 0x09] }[q];
  if (diag) return diag[slide ? 0 : 1];
  var plain = { 0: 0x00, 15: 0x0f, 3: 0x0c, 12: 0x03, 5: 0x07, 10: 0x08 }[q];
  return plain === undefined ? -1 : plain;
}

/** The shape a cell has now: its override, else the estimate its stamp carries. */
function collEffectiveCode(x, y) {
  var o = editCollisionAt(x, y);
  if (o >= 0) return o;
  return collEstimate(x, y);
}

/** The estimate: the stamp's geometry, open under always-walkable or with nothing drawn. */
function collEstimate(x, y) {
  var i = typeof editCellAt === 'function' ? editCellAt(_mtPalette, x, y) : -1;
  var w = i >= 0 ? editStampWords(_mtPalette, i) : null;
  return !w || (w.collision & 0x2000) ? 0 : w.collision & 0x0f;
}

/** What drawing (or erasing) one quarter makes of a cell: a code, or -1 for none. */
function collDrawResult(cell, erasing) {
  var have = collEffectiveCode(cell.x, cell.y);
  var bit = 1 << ((cell.qy ? 2 : 0) + (cell.qx ? 1 : 0));
  var q = erasing ? collQuarters(have) & ~bit : collQuarters(have) | bit;
  // Unchanged quarters keep the cell's own code, its twin included.
  return q === collQuarters(have) ? have : collCodeOfQuarters(q, _collSlide);
}

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
  var was = editCollisionAt(cell.x, cell.y);
  var to;
  if (_collMode === 'draw' && cell.qx != null) {
    var code = collDrawResult(cell, erasing);
    if (code < 0) { editNote('two opposite corners make no collision shape — draw a third, or erase one'); return; }
    // Back to what the tile's own estimate is: no override needed.
    to = code === collEstimate(cell.x, cell.y) ? null : code;
  } else {
    if (!erasing && _collPick < 0) return;
    to = erasing ? null : _collPick;
  }
  if ((to === null ? -1 : to) === was) return;
  editApply([{ x: cell.x, y: cell.y, index: to, layer: 'coll' }]);
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** A click the Collision tab owns (map-editor-input.js). */
function collClick(t) {
  var ds = t.dataset;
  if (ds.collPick !== undefined) { _collMode = 'shapes'; collPick(ds.collPick); return; }
  if (ds.collMode) _collMode = ds.collMode;
  if (ds.collSlide) _collSlide = ds.collSlide === 'slide';
  if (ds.collVanilla) _collVanillaOnly = !_collVanillaOnly;
  var d = editDraft();
  if ((ds.collMode === 'draw' || ds.collSlide) && d && !editLocked()) d.tool = 'paint';
  if (_collMode === 'draw') editNote('pencil: draw collision on the 8px grid — the eraser takes quarters off');
  renderEditChrome();
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

/** The tab: the filter row, the two ways to draw, and every shape. */
function collisionTabHtml() {
  var d = editDraft();
  var color = collLevelColor(typeof editLevel === 'function' ? editLevel() : 1);
  var n = Object.keys((d && d.coll) || {}).length;
  var uses = _mtPalette && _mtPalette.vanillaGeometry;
  var seg = function (attr, val, on, label, tip) {
    return '<button class="rdf rg-subtab' + (on ? ' on' : '') + '" data-' + attr + '="' + val + '" title="' + escH(tip) + '">' + label + '</button>';
  };
  var html = '<div class="rg-coll-filters">'
    + '<button class="rdf rg-chip-toggle' + (_collVanillaOnly ? ' on' : '') + '" data-coll-vanilla="1" aria-pressed="' + _collVanillaOnly
    + '" title="Only the shapes vanilla places somewhere">Used in vanilla</button></div>'
    + '<div class="rg-subtabs">'
    + seg('coll-mode', 'shapes', _collMode === 'shapes', 'Shapes', 'Pick a shape; the pencil sets it on whole cells')
    + seg('coll-mode', 'draw', _collMode === 'draw', 'Draw 8px', 'Freehand on the 8px grid: the quarters you fill name the shape') + '</div>';
  if (_collMode === 'draw') {
    html += '<div class="rs-note">Fill 8px quarters: two along a side make a half (_), an L of three or one corner a 45° diagonal (L). '
      + 'Two opposite corners make no shape. The eraser takes quarters off.</div>'
      + '<div class="rg-coll-slide">Diagonals: '
      + seg('coll-slide', 'slide', _collSlide, 'slide along', COLL_HOW.slides)
      + seg('coll-slide', 'stop', !_collSlide, 'stop you', COLL_HOW.stops) + '</div>';
  }
  html += '<div class="rg-special-group"><div class="rg-special-h">Collision shape</div>'
    + '<div class="rs-note">Sets a cell’s shape by hand, over the one its tile was given. The tile keeps its estimate: '
    + 'erase the override and it comes back. Shown in the level’s colour; it clears always-walkable (stairs, drift).'
    + (n ? ' ' + n + ' cell' + (n === 1 ? '' : 's') + ' set by hand.' : '') + '</div>'
    + '<div class="rg-coll-grid">';
  COLL_CODES.forEach(function (c) {
    var count = uses ? uses[c[0]] || 0 : null;
    if (_collVanillaOnly && count === 0) return;
    var on = _collMode === 'shapes' && _collPick === c[0];
    var tip = c[1] + (c[3] ? ', ' + c[3] : '') + ' — code 0x' + c[0].toString(16)
      + (count != null ? '\nPlaced on ' + count + ' vanilla cell' + (count === 1 ? '' : 's') : '')
      + (c[3] ? '\n' + COLL_HOW[c[3]] : c[2] != null ? '\nSame solid pixels as 0x' + c[2].toString(16)
        + (count === 0 ? '; open in the engine’s tables, and no vanilla room places it' : '') : '');
    html += '<button class="rdf rg-coll-chip' + (on ? ' on rg-armed' : '') + '" data-coll-pick="' + c[0] + '" title="' + escH(tip) + '">'
      + collSwatchSvg(c[0], color) + '<span class="rg-coll-lbl">' + escH(c[1] + (c[3] ? ' · ' + c[3] : '')) + '<b>0x' + c[0].toString(16) + '</b></span></button>';
  });
  return html + '</div></div>';
}
