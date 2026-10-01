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
// One pen. With the **8px pen** armed (the list's first entry, the default)
// it draws and carves 8px squares into the cell's collision as it is now —
// the prediction, or a shape set earlier — and the cell keeps the drawing as
// drawn (`_edit.collDraw`, "x,y" -> quarters: 1 TL, 2 TR, 4 BL, 8 BR, plus
// 16 for the diagonal twin that stops). The cell takes a code only while the
// quarters match a 16px tile: none open, all four solid, two along a side a
// half, an L of three the 45° diagonal on that side. A lone corner or two
// opposite corners match nothing: drawn, marked, and the cell keeps its own.
// With a **shape** armed it sets whole cells (`_edit.coll`). A cell holds one
// or the other. Right-click carves (an 8px square, or a whole cell open);
// the eraser takes the override away, back to the prediction.
//
// Owns: _collPick, _collVanillaOnly, _collCarving.

/** The armed entry: -1 the 8px pen, else a shape code 0..15. */
var _collPick = -1;
/** Hide the codes no vanilla room places (the filter row). */
var _collVanillaOnly = true;
/** A right-button carve in progress. */
var _collCarving = false;

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
/** The diagonal twins that stop you; their 3-point twins slide (COLL_CODES). */
var COLL_STOPPERS = { 0x06: true, 0x05: true, 0x0a: true, 0x09: true };

/** The code quarters match, or -1. `stop` picks the diagonal twin. */
function collCodeOfQuarters(q, stop) {
  var diag = { 13: [0x02, 0x06], 14: [0x01, 0x05], 7: [0x0e, 0x0a], 11: [0x0d, 0x09] }[q];
  if (diag) return diag[stop ? 1 : 0];
  var plain = { 0: 0x00, 15: 0x0f, 3: 0x0c, 12: 0x03, 5: 0x07, 10: 0x08 }[q];
  return plain === undefined ? -1 : plain;
}

/** The quarters a code fills — what the pen starts from (twins alike; 0x04/0x0B are open). */
function collQuarters(code) {
  return ({ 0x0f: 15, 0x0c: 3, 0x03: 12, 0x07: 5, 0x08: 10,
    0x02: 13, 0x06: 13, 0x01: 14, 0x05: 14, 0x0e: 7, 0x0a: 7, 0x0d: 11, 0x09: 11 })[code] || 0;
}

/** The drawing at a cell (quarters + stop flag), or -1 when there is none. */
function collDrawAt(x, y) {
  var d = editDraft();
  var k = editKey(x, y);
  return d && d.collDraw && Object.prototype.hasOwnProperty.call(d.collDraw, k) ? d.collDraw[k] : -1;
}

/** The code a cell's drawing gives it, or -1 (no drawing, or one that matches nothing). */
function collDrawCode(x, y) {
  var v = collDrawAt(x, y);
  return v < 0 ? -1 : collCodeOfQuarters(v & 15, v & COLL_STOP);
}

/** The prediction: the stamp's geometry, open under always-walkable or with nothing drawn. */
function collEstimate(x, y) {
  var i = typeof editCellAt === 'function' ? editCellAt(_mtPalette, x, y) : -1;
  var w = i >= 0 ? editStampWords(_mtPalette, i) : null;
  return !w || (w.collision & 0x2000) ? 0 : w.collision & 0x0f;
}

/** What the pen starts from at a cell: its drawing, else its shape now as quarters. */
function collDrawBase(x, y) {
  var v = collDrawAt(x, y);
  if (v >= 0) return v;
  var code = editCollisionAt(x, y);
  if (code < 0) code = collEstimate(x, y);
  return collQuarters(code) | (COLL_STOPPERS[code] ? COLL_STOP : 0);
}

/** The drawing after the pen (or a carve) on one 8px quarter. */
function collDrawNext(cell, carving) {
  var bit = 1 << ((cell.qy ? 2 : 0) + (cell.qx ? 1 : 0));
  var v = collDrawBase(cell.x, cell.y);
  return carving ? v & ~bit : v | bit;
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

/** Arm an entry: -1 the 8px pen, else a shape. Shown under the pencil. */
function collPick(code) {
  _collPick = Number(code);
  var d = editDraft();
  if (d && !editLocked()) d.tool = 'paint';
  var def = collCodeDef(_collPick);
  editNote(def ? 'pencil: ' + def[1] + ' (0x' + _collPick.toString(16) + ') on whole cells — right-click opens a cell'
    : 'pencil: 8px pen — draw, right-click to carve; the eraser goes back to the prediction');
  renderEditChrome();
}

function collCodeDef(code) {
  for (var i = 0; i < COLL_CODES.length; i++) if (COLL_CODES[i][0] === code) return COLL_CODES[i];
  return null;
}

/**
 * The Collision tab on one cell: `draw` (left button), `carve` (right
 * button) or `reset` (the eraser: back to the prediction). One write per
 * layer, folded into the gesture's one undo step.
 */
function editCollisionStroke(cell, how) {
  if (how === true) how = 'reset';
  else if (how === false || how == null) how = 'draw';
  var d = editDraft(), k = editKey(cell.x, cell.y);
  var picked = !!(d && d.coll && Object.prototype.hasOwnProperty.call(d.coll, k));
  var drawn = collDrawAt(cell.x, cell.y) >= 0;
  var coll, draw;                     // undefined: leave that layer alone; null: clear it
  if (how === 'reset') {
    if (!picked && !drawn) return;
    coll = null; draw = null;
  } else if (_collPick < 0 && cell.qx != null) {
    var next = collDrawNext(cell, how === 'carve');
    if (next === collDrawBase(cell.x, cell.y) && drawn) return;
    // Drawn back to exactly the prediction: no override left.
    var same = !picked && collCodeOfQuarters(next & 15, next & COLL_STOP) === collEstimate(cell.x, cell.y)
      && (next & 15) === collQuarters(collEstimate(cell.x, cell.y));
    if (same && !drawn) return;
    draw = same ? null : next;
    if (picked) coll = null;
  } else {
    var to = how === 'carve' ? 0x00 : _collPick;
    if (to < 0 || (picked && d.coll[k] === to)) return;
    coll = to;
    if (drawn) draw = null;
  }
  var writes = [];
  if (coll !== undefined) writes.push({ x: cell.x, y: cell.y, index: coll, layer: 'coll' });
  if (draw !== undefined) writes.push({ x: cell.x, y: cell.y, index: draw, layer: 'collDraw' });
  editApply(writes);
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** A click the Collision tab owns (map-editor-input.js). */
function collClick(t) {
  if (t.dataset.collPick !== undefined) { collPick(t.dataset.collPick); return; }
  if (t.dataset.collVanilla) _collVanillaOnly = !_collVanillaOnly;
  renderEditChrome();
}

/**
 * Right-button carving on the map, Collision tab only: a gesture of its own
 * (map-editor-gestures.js takes the left button), one undo step per drag.
 * Bound once per rendered map (detail-renderer.js).
 */
function setupCollisionCarve() {
  var wrap = document.getElementById('rg-wrap');
  if (!wrap || wrap.dataset.collCarveBound) return;
  wrap.dataset.collCarveBound = '1';
  var on = function () { return editActive() && !editLocked() && drawKind() === 'collision'; };
  wrap.addEventListener('contextmenu', function (e) { if (on()) e.preventDefault(); }, true);
  wrap.addEventListener('mousedown', function (e) {
    if (e.button !== 2 || !on()) return;
    var cell = editEventCell(e);
    if (!cell) return;
    _collCarving = true;
    editBegin();
    editCollisionStroke(cell, 'carve');
    e.preventDefault(); e.stopPropagation();
  }, true);
  wrap.addEventListener('mousemove', function (e) {
    if (!_collCarving) return;
    var cell = editEventCell(e);
    if (cell && editInBounds(_mtPalette, cell.x, cell.y)) editCollisionStroke(cell, 'carve');
  }, true);
  // Released anywhere, the carve ends — once per page, not per map.
  if (typeof window === 'undefined' || !window.addEventListener || window._collCarveBound) return;
  window._collCarveBound = true;
  window.addEventListener('mouseup', function (e) {
    if (!_collCarving || e.button !== 2) return;
    _collCarving = false;
    editEnd();
    renderEditChrome();
  });
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
  // A drawing that matches a tile is shown as that tile — the 45° it makes,
  // not the squares that made it — with the squares traced faintly over it.
  // One that matches none: grey squares, an amber dotted box and a "?" —
  // never a level colour, which it would be mistaken for (level 1 is red).
  Object.keys(d.collDraw || {}).forEach(function (k) {
    var p = k.split(','), x = Number(p[0]), y = Number(p[1]);
    if (!editInBounds(_mtPalette, x, y)) return;
    html += collDrawnCellSvg(editCellPos(origin, x, y), d.collDraw[k], collDrawCode(x, y), collLevelColor(collCellLevel(x, y)));
  });
  return html;
}

/** The 8px squares of a drawing, as one path. */
function collSquaresPath(a, v) {
  var h = EDIT_UNITS / 2, sq = '';
  for (var b = 0; b < 4; b++) if (v & (1 << b)) sq += 'M' + (a.x + (b & 1) * h) + ' ' + (a.y + (b >> 1) * h) + 'h' + h + 'v' + h + 'h' + (-h) + 'z';
  return sq;
}

/** One drawn cell: the tile it matches, or its squares marked as matching none. */
function collDrawnCellSvg(a, v, code, col) {
  var sq = collSquaresPath(a, v);
  if (code >= 0) {
    return '<g class="rg-coll-drawn"><path d="' + collMaskPath(code, a.x, a.y, EDIT_UNITS / 16) + '" fill="' + col + '" fill-opacity=".6"/>'
      + (sq ? '<path d="' + sq + '" fill="none" stroke="' + col + '" stroke-width="0.06" stroke-opacity=".7"/>' : '')
      + collCellBoxSvg(a, col, false) + '<title>drawn: ' + collCodeDef(code)[1] + ' (0x' + code.toString(16) + ')</title></g>';
  }
  var warn = 'var(--rg-warning, #e3b341)';
  return '<g class="rg-coll-drawn bad">' + (sq ? '<path d="' + sq + '" fill="rgba(200,200,200,.35)"/>' : '')
    + collCellBoxSvg(a, warn, true)
    + '<text x="' + (a.x + EDIT_UNITS / 2) + '" y="' + (a.y + EDIT_UNITS * 0.68) + '" text-anchor="middle" font-size="' + (EDIT_UNITS * 0.5)
    + '" fill="' + warn + '" font-weight="bold" pointer-events="none">?</text>'
    + '<title>drawn, but no collision tile looks like this — the cell keeps its own shape</title></g>';
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

/** The 8px pen's own swatch: a 2×2 of quarters, one drawn. */
function collPenSwatchSvg(color) {
  return '<svg class="rg-coll-swatch" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">'
    + '<rect width="16" height="16" class="rg-coll-swatch-bg"/>'
    + '<path d="M0 8h8v8h-8zM8 8h8v8h-8zM0 0h8v8h-8z" fill="' + color + '" fill-opacity=".75"/>'
    + '<path d="M8 0v16M0 8h16" stroke="currentColor" stroke-opacity=".5" stroke-width=".6"/></svg>';
}

/** The pencil's badge on the Collision tab: what it draws, in miniature (map-editor-drawable.js). */
function collBadgeSvg() {
  var color = collLevelColor(typeof editLevel === 'function' ? editLevel() : 1);
  return _collPick < 0 ? collPenSwatchSvg(color) : collSwatchSvg(_collPick, color);
}

/** The tab: the filter row, the pen, every shape, and how the buttons work. */
function collisionTabHtml() {
  var d = editDraft();
  var color = collLevelColor(typeof editLevel === 'function' ? editLevel() : 1);
  var n = Object.keys((d && d.coll) || {}).length + Object.keys((d && d.collDraw) || {}).length;
  var uses = _mtPalette && _mtPalette.vanillaGeometry;
  var html = '<div class="rg-coll-filters">'
    + '<button class="rdf rg-chip-toggle' + (_collVanillaOnly ? ' on' : '') + '" data-coll-vanilla="1" aria-pressed="' + _collVanillaOnly
    + '" title="Only the shapes vanilla places somewhere">Used in vanilla</button></div>'
    + '<div class="rg-coll-keys"><span><kbd>Left</kbd> draw</span><span><kbd>Right</kbd> carve</span>'
    + '<span><kbd>Eraser</kbd> back to predicted</span></div>'
    + '<div class="rg-coll-grid">'
    + '<button class="rdf rg-coll-chip rg-coll-pen' + (_collPick < 0 ? ' on rg-armed' : '') + '" data-coll-pick="-1" title="'
    + escH('8px pen — draws and carves 8px squares into the collision the cell has now. A 16px cell takes a tile while its squares '
      + 'match one: all four, two along a side, an L of three (45°). A lone corner or opposite corners match none: '
      + 'they stay drawn with a "?", and the cell keeps its own.') + '">'
    + collPenSwatchSvg(color) + '<span class="rg-coll-lbl">8px pen<b>draw · carve</b></span></button>';
  COLL_CODES.forEach(function (c) {
    var count = uses ? uses[c[0]] || 0 : null;
    if (_collVanillaOnly && count === 0) return;
    var on = _collPick === c[0];
    var tip = c[1] + (c[3] ? ', ' + c[3] : '') + ' — code 0x' + c[0].toString(16) + ', on whole cells'
      + (count != null ? '\nPlaced on ' + count + ' vanilla cell' + (count === 1 ? '' : 's') : '')
      + (c[3] ? '\n' + COLL_HOW[c[3]] : c[2] != null ? '\nSame solid pixels as 0x' + c[2].toString(16)
        + (count === 0 ? '; open in the engine’s tables, and no vanilla room places it' : '') : '');
    html += '<button class="rdf rg-coll-chip' + (on ? ' on rg-armed' : '') + '" data-coll-pick="' + c[0] + '" title="' + escH(tip) + '">'
      + collSwatchSvg(c[0], color) + '<span class="rg-coll-lbl">' + escH(c[1] + (c[3] ? ' · ' + c[3] : '')) + '<b>0x' + c[0].toString(16) + '</b></span></button>';
  });
  return html + '</div><div class="rs-note rg-coll-foot">Over the collision each tile was predicted; '
    + 'it clears always-walkable (stairs, drift).' + (n ? ' ' + n + ' cell' + (n === 1 ? '' : 's') + ' set by hand.' : '') + '</div>';
}
