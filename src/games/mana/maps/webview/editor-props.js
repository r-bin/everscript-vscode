// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: what a Secret of Mana cell *is* — its 4 collision bytes read as properties (shape, floor level,
// stairs, push, layer switch, return cell, step-on/walk-into, cut, strike) — and what the user wants a cell to
// be. The user never edits bytes: they draw a wish per cell (a shape, an effect, a switch, how its trigger
// fires) on a layer of its own, and the solver finds metatiles that give each cell its picture *and* its wish.
// No DOM; runs under Node in the unit test. Plain browser script: defines globals (and `module.exports`).
//
// Why a solver: collision belongs to the metatile, never the cell ($02:A043). A cell gets other collision only
// by showing another metatile with the same picture: an existing one that already fits, else a copy of its
// metatile in a slot nothing on the map uses (never 0, the eraser's metatile). A copy keeps every byte and changes only the wished fields. When
// no slot is free, or the cell shows a step-event metatile (its number is its event), the cell is "unfit":
// it keeps its own metatile and is marked. Nothing is ever rounded to something the user did not draw.
// The bytes, with evidence: docs/mana/README.md "Collision".

/** The 8 px quarters of a cell: 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right. Diagonal d -> its solid quarters. */
var MANA_ED_DIAG_QUARTERS = { 4: 13, 5: 11, 6: 7, 7: 14 };
var MANA_ED_PUSH_DIRS = ['up', 'down', 'left', 'right'];

/** The cell's shape: 'open', 'wall' or a half wall 4-7 (c0 bits 0-2 = 3 is a wall; c2 $1n with n&7 >= 4 a diagonal). */
function manaEdShapeOf(c) {
  if ((c[2] & 0xF0) === 0x10 && (c[2] & 7) >= 4) return c[2] & 7;
  return (c[0] & 7) === 3 ? 'wall' : 'open';
}

function manaEdQuartersOf(shape) { return shape === 'wall' ? 15 : shape === 'open' ? 0 : MANA_ED_DIAG_QUARTERS[shape]; }

/** The shape drawn 8 px quarters make, or null: Mana has no half-cell straight wall and no lone corner. */
function manaEdShapeOfQuarters(q) {
  if (q === 0) return 'open';
  if (q === 15) return 'wall';
  for (var d in MANA_ED_DIAG_QUARTERS) if (MANA_ED_DIAG_QUARTERS[d] === q) return Number(d);
  return null;
}

/** The floor level c0 bits 0-2 give a walker: 0 none, 1, 2, 4-7 "keeps the walker's level"; a wall has none. */
function manaEdLevelOf(c) { var f = c[0] & 7; return f === 3 ? null : f; }

/** What c2 does (docs/mana/README.md): stairs $2n, push $3n, cut $Cn, strike $Fn, diagonal $1n; null for none. */
function manaEdEffectOf(c) {
  var hi = c[2] >> 4, n = c[2] & 15;
  if (hi === 2) return { kind: 'stairs', c2: c[2] };
  if (hi === 3) return { kind: 'push', c2: c[2], dir: n & 3, speed: (n >> 2) + 1 };
  if (hi === 0xC) return { kind: 'cut', n: n, to: c[3] };
  if (hi === 0xF) return { kind: 'strike', event: c[3] * 16 + n };
  return null;
}

/** The weapon types that cut a `$Cn` cell (`$01:D3AB`). */
function manaEdCutWeapons(n) {
  return n < 8 ? 'type ' + n : n === 8 ? 'types 1, 2' : n === 9 ? 'types 3, 4' : n === 10 ? 'types 5+' : n === 11 ? 'types 0-2' : 'no weapon';
}

/** One wish applied to bytes `c` (in place). Returns false when the wish has no Mana shape (8 px quarters that fit none). */
function manaEdApplyWish(c, field, w) {
  if (field === 'coll') {
    var shape = w.quarters !== undefined ? manaEdShapeOfQuarters(w.quarters) : w.shape;
    if (shape === null) return false;
    var lv = w.level === null || w.level === undefined ? manaEdLevelOf(c) : w.level;
    if (lv === null) lv = 0;
    var diag = (c[2] & 0xF0) === 0x10;
    if (shape === 'wall') c[0] = (c[0] & ~7) | 3;
    else c[0] = (c[0] & ~7) | lv;
    if (typeof shape === 'number') { c[2] = 0x10 | shape; c[3] = 0; }
    else if (diag) { c[2] = 0; c[3] = 0; }
  } else if (field === 'eff') {
    // A stairs or push value takes c2 (and c3) whatever held it; "none" clears only a stairs or push there.
    if (w.c2) { c[2] = w.c2; c[3] = 0; }
    else if ((c[2] >> 4) === 2 || (c[2] >> 4) === 3) { c[2] = 0; c[3] = 0; }
  } else if (field === 'sw') c[0] = w.on ? c[0] | 8 : c[0] & ~8;
  else if (field === 'walk') c[1] = w.on ? c[1] | 0x40 : c[1] & ~0x40;
  return true;
}

var MANA_ED_WISHES = ['coll', 'eff', 'sw', 'walk'];

/** Set (or with `w` null remove) one wish on a cell. Returns the change to record, or null when nothing changes. */
function manaEdSetWish(m, layer, i, field, w) {
  if (layer === 'B' && !m.sizeB) return null;
  var map = m.wish[layer], before = map[i] ? manaEdClone(map[i]) : null;
  var after = before ? manaEdClone(before) : {};
  if (w) { after[field] = manaEdClone(w); after[field].seq = ++m.seq; } else delete after[field];
  if (!Object.keys(after).length) after = null;
  if (JSON.stringify(stripSeq(before)) === JSON.stringify(stripSeq(after))) return null;
  var change = { k: 'wish', layer: layer, i: i, before: before, after: after };
  manaEdApplyWishChange(m, change, 'after');
  return change;
}

function stripSeq(e) {
  if (!e) return null;
  var o = {};
  Object.keys(e).sort().forEach(function (k) { o[k] = Object.assign({}, e[k]); delete o[k].seq; });
  return o;
}

function manaEdApplyWishChange(m, change, which) {
  if (change[which]) m.wish[change.layer][change.i] = manaEdClone(change[which]);
  else delete m.wish[change.layer][change.i];
  m.ver++;
}

/** The cell's (x, y) for an index into a layer's array. */
function manaEdCellXY(m, layer, i) {
  var w = layer === 'A' ? m.w : m.sizeB.w;
  return { x: i % w, y: Math.floor(i / w) };
}

/**
 * Solve a layer: which metatile each wished cell shows and its bytes. Cached until the model changes.
 * {cells: {i: {n, bytes, unfit, why}}, copies: [{slot, pic, bytes}], used, room, unfit}
 */
function manaEdSolve(m, layer) {
  var key = m.ver + '|' + m.pieceState.join(',');
  if (m.solved[layer] && m.solved[layer].key === key) return m.solved[layer];
  var out = { key: key, cells: {}, copies: [], used: 0, room: 0, unfit: 0 };
  m.solved[layer] = out;
  if (layer === 'B' && !m.sizeB) return out;
  var tiles = m.tiles[layer], firstEvent = 0xC0 - (m.lead || 0), used = [], n, x, y;
  var w = layer === 'A' ? m.w : m.sizeB.w, h = layer === 'A' ? m.h : m.sizeB.h;
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) used[manaEdCell(m, layer, x, y)] = true;
  m.pieces.forEach(function (p) { p.frames.forEach(function (f) { Object.keys(f).forEach(function (k) { if (f[k][layer] >= 0) used[f[k][layer]] = true; }); }); });
  // A cut cell becomes metatile c3: that one is in use too.
  for (n = 0; n < 192; n++) if (used[n] && (tiles[n].coll[2] >> 4) === 0xC && tiles[n].coll[3] < 192) used[tiles[n].coll[3]] = true;
  var free = [], fit = {};
  for (n = 0; n < 192; n++) {
    if (used[n]) out.used++;
    else if (n > 0 && n < firstEvent) free.push(n);   // 0 is what Erase paints: never a copy
    var k0 = n + ':' + tiles[n].coll.join(',');
    if (fit[k0] === undefined) fit[k0] = n;
  }
  Object.keys(m.wish[layer]).map(Number).sort(function (a, b) { return a - b; }).forEach(function (i) {
    var xy = manaEdCellXY(m, layer, i), base = manaEdCell(m, layer, xy.x, xy.y);
    if (base < 0 || base > 191) return;
    var own = tiles[base].coll, bytes = own.slice(), e = m.wish[layer][i], ok = true;
    MANA_ED_WISHES.filter(function (f) { return e[f]; }).sort(function (a, b) { return e[a].seq - e[b].seq; })
      .forEach(function (f) { if (!manaEdApplyWish(bytes, f, e[f])) ok = false; });
    var cell = { n: base, bytes: bytes, unfit: !ok, why: ok ? '' : 'no Mana shape is drawn like this' };
    if (ok && bytes.join(',') !== own.join(',')) {
      var k = tiles[base].pic + ':' + bytes.join(','), slot = fit[k];
      if (slot === undefined && base >= firstEvent) { cell.unfit = true; cell.why = 'its metatile is a step event: a copy would run another event'; }
      else if (slot === undefined && !free.length) { cell.unfit = true; cell.why = 'no free metatile left (' + out.used + ' in use)'; }
      else if (slot === undefined) {
        slot = free.shift();
        fit[k] = slot;
        out.used++;
        out.copies.push({ slot: slot, pic: tiles[base].pic, bytes: bytes.slice() });
      }
      if (!cell.unfit) cell.n = slot;
    }
    // An unfit cell keeps its own metatile, all of it: nothing is rounded to what was not drawn.
    if (cell.unfit) { cell.bytes = own.slice(); cell.n = base; out.unfit++; }
    out.cells[i] = cell;
  });
  out.room = firstEvent;
  return out;
}

/** The metatile a cell shows once the wishes are solved. */
function manaEdCellMetatile(m, layer, x, y) {
  var n = manaEdCell(m, layer, x, y);
  if (n < 0) return n;
  var s = manaEdSolve(m, layer).cells[manaEdIndex(m, layer, x, y)];
  return s ? s.n : n;
}

/** The 4 collision bytes a cell has once the wishes are solved (zeros where the layer has no cell). */
function manaEdCellBytes(m, layer, x, y) {
  var n = manaEdCell(m, layer, x, y);
  if (n < 0 || n > 191) return [0, 0, 0, 0];
  var s = manaEdSolve(m, layer).cells[manaEdIndex(m, layer, x, y)];
  return s ? s.bytes : m.tiles[layer][n].coll;
}

/** The wish on a cell ({coll, eff, sw, walk}) and how it solved ({n, bytes, unfit, why}), or nulls. */
function manaEdWishAt(m, layer, x, y) {
  if (layer === 'B' && !m.sizeB) return { wish: null, solved: null };
  var i = manaEdIndex(m, layer, x, y);
  return { wish: m.wish[layer][i] || null, solved: manaEdSolve(m, layer).cells[i] || null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { manaEdShapeOf: manaEdShapeOf, manaEdQuartersOf: manaEdQuartersOf, manaEdShapeOfQuarters: manaEdShapeOfQuarters,
    manaEdLevelOf: manaEdLevelOf, manaEdEffectOf: manaEdEffectOf, manaEdCutWeapons: manaEdCutWeapons, manaEdApplyWish: manaEdApplyWish,
    manaEdSetWish: manaEdSetWish, manaEdApplyWishChange: manaEdApplyWishChange, manaEdSolve: manaEdSolve, manaEdCellMetatile: manaEdCellMetatile,
    manaEdCellBytes: manaEdCellBytes, manaEdWishAt: manaEdWishAt, MANA_ED_PUSH_DIRS: MANA_ED_PUSH_DIRS };
}
