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
// Two ways to set one: **Shapes** (pick one of the codes; `_edit.coll`) and
// **Draw 8px** — a pen on the 8px grid. The drawing is kept as drawn
// (`_edit.collDraw`, "x,y" -> the four quarters, bits 1 TL, 2 TR, 4 BL,
// 8 BR, plus 16 for "diagonals stop"), and a cell takes a shape only while
// its quarters match a 16px tile: all four solid, two along a side a half,
// an L of three the 45° diagonal on that side. A lone corner or two
// opposite corners match nothing — they stay drawn, marked, and the cell
// keeps its own shape. A cell has a picked shape or a drawing, never both.
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

// ── the 8px drawing ─────────────────────────────────────────────────────────

var COLL_STOP = 16;

/** The code a drawing's quarters match, or -1 when they match no tile (or nothing is drawn). */
function collCodeOfQuarters(q, slide) {
  var diag = { 13: [0x02, 0x06], 14: [0x01, 0x05], 7: [0x0e, 0x0a], 11: [0x0d, 0x09] }[q];
  if (diag) return diag[slide ? 0 : 1];
  var plain = { 15: 0x0f, 3: 0x0c, 12: 0x03, 5: 0x07, 10: 0x08 }[q];
  return plain === undefined ? -1 : plain;
}

/** The drawing at a cell (quarters + stop flag), or 0. */
function collDrawAt(x, y) {
  var d = editDraft();
  var k = editKey(x, y);
  return d && d.collDraw && Object.prototype.hasOwnProperty.call(d.collDraw, k) ? d.collDraw[k] : 0;
}

/** The code a cell's drawing gives it, or -1. */
function collDrawCode(x, y) {
  var v = collDrawAt(x, y);
  return v ? collCodeOfQuarters(v & 15, !(v & COLL_STOP)) : -1;
}

/** The pen (or eraser) on one 8px quarter: the drawing's next value, 0 = nothing drawn. */
function collDrawNext(cell, erasing) {
  var bit = 1 << ((cell.qy ? 2 : 0) + (cell.qx ? 1 : 0));
  var q = collDrawAt(cell.x, cell.y) & 15;
  q = erasing ? q & ~bit : q | bit;
  return q ? q | (_collSlide ? 0 : COLL_STOP) : 0;
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

/** The override at a cell — a picked shape, else what its drawing matches — or -1. */
function editCollisionAt(x, y) {
  var d = editDraft();
  var k = editKey(x, y);
  if (d && d.coll && Object.prototype.hasOwnProperty.call(d.coll, k)) return d.coll[k];
  return collDrawCode(x, y);
}

/** A collision word with the cell's override applied (unchanged without one). */
function editCollisionApplied(x, y, cw) {
  var code = editCollisionAt(x, y);
  return code < 0 ? cw : (cw & ~0x200f) | code;
}

/** Every override, for a vanilla room's handoff: `[{x, y, geometry}]`. */
function editCollisionPayload() {
  var d = editDraft();
  var keys = Object.keys((d && d.coll) || {}).concat(Object.keys((d && d.collDraw) || {}));
  var out = [];
  keys.forEach(function (k) {
    var p = k.split(','), x = Number(p[0]), y = Number(p[1]), g = editCollisionAt(x, y);
    if (g >= 0 && !out.some(function (o) { return o.x === x && o.y === y; })) out.push({ x: x, y: y, geometry: g });
  });
  return out;
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

/**
 * The Collision tab's pencil (or eraser) on one cell. Shapes: the picked code
 * on the `coll` layer. Draw: one 8px quarter of the drawing on `collDraw`.
 * Either clears the other at that cell, in the same undo step.
 */
function editCollisionStroke(cell, erasing) {
  var writes = [];
  var k = editKey(cell.x, cell.y), d = editDraft();
  var picked = d && d.coll && Object.prototype.hasOwnProperty.call(d.coll, k);
  if (_collMode === 'draw' && cell.qx != null) {
    var next = collDrawNext(cell, erasing);
    if (next === collDrawAt(cell.x, cell.y) && !picked) return;
    writes.push({ x: cell.x, y: cell.y, index: next || null, layer: 'collDraw' });
    // A picked shape there goes, pen or eraser — the drawing is the cell's now.
    if (picked) writes.push({ x: cell.x, y: cell.y, index: null, layer: 'coll' });
  } else {
    if (!erasing && _collPick < 0) return;
    if (erasing ? !picked && !collDrawAt(cell.x, cell.y) : picked && d.coll[k] === _collPick) return;
    writes.push({ x: cell.x, y: cell.y, index: erasing ? null : _collPick, layer: 'coll' });
    if (collDrawAt(cell.x, cell.y)) writes.push({ x: cell.x, y: cell.y, index: null, layer: 'collDraw' });
  }
  editApply(writes);
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
  if (!d || !(d.coll || d.collDraw)) return '';
  var showing = (typeof _editActiveTab !== 'undefined' && _editActiveTab === 'collision')
    || (typeof collisionOn === 'function' && collisionOn());
  if (!showing) return '';
  var s = EDIT_UNITS / 16, h = EDIT_UNITS / 2;
  var html = '';
  Object.keys(d.coll || {}).forEach(function (k) {
    var p = k.split(','), x = Number(p[0]), y = Number(p[1]);
    if (!editInBounds(_mtPalette, x, y)) return;
    var a = editCellPos(origin, x, y), col = collLevelColor(collCellLevel(x, y));
    html += '<g class="rg-coll-override"><path d="' + collMaskPath(d.coll[k], a.x, a.y, s) + '" fill="' + col + '" fill-opacity=".55"/>'
      + collCellBoxSvg(a, col, false) + '<title>collision picked: ' + collCodeDef(d.coll[k])[1] + ' (0x' + d.coll[k].toString(16) + ')</title></g>';
  });
  // The drawing, as drawn: its 8px squares. Matching a tile, in the level's
  // colour; matching none, marked — that cell keeps its own shape.
  Object.keys(d.collDraw || {}).forEach(function (k) {
    var p = k.split(','), x = Number(p[0]), y = Number(p[1]), v = d.collDraw[k];
    if (!editInBounds(_mtPalette, x, y)) return;
    var a = editCellPos(origin, x, y), code = collDrawCode(x, y), ok = code >= 0;
    var col = ok ? collLevelColor(collCellLevel(x, y)) : 'var(--rg-error, #e5534b)';
    var sq = '';
    for (var b = 0; b < 4; b++) if (v & (1 << b)) sq += 'M' + (a.x + (b & 1) * h) + ' ' + (a.y + (b >> 1) * h) + 'h' + h + 'v' + h + 'h' + (-h) + 'z';
    html += '<g class="rg-coll-drawn' + (ok ? '' : ' bad') + '"><path d="' + sq + '" fill="' + col + '" fill-opacity="' + (ok ? '.55' : '.35') + '"/>'
      + collCellBoxSvg(a, col, !ok) + '<title>' + (ok ? 'drawn: ' + collCodeDef(code)[1] + ' (0x' + code.toString(16) + ')'
        : 'drawn, but no collision tile looks like this — the cell keeps its own shape') + '</title></g>';
  });
  return html;
}

function collCellBoxSvg(a, col, bad) {
  return '<rect x="' + (a.x + 0.05) + '" y="' + (a.y + 0.05) + '" width="' + (EDIT_UNITS - 0.1) + '" height="' + (EDIT_UNITS - 0.1)
    + '" fill="none" stroke="' + col + '" stroke-width="' + (bad ? 0.12 : 0.08) + '" stroke-dasharray="' + (bad ? '0.12 0.12' : '0.3 0.2') + '"/>';
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
    html += '<div class="rs-note">A pen on the 8px grid. Where a 16px cell’s drawing matches a collision tile — all four, two along a side '
      + '(_), an L of three (45°) — the cell takes it. A lone corner or two opposite corners match none: they stay drawn, marked, '
      + 'and the cell keeps its own shape. The eraser takes 8px squares off.</div>'
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
