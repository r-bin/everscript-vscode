// Ownership: the Secret of Mana map being edited, as plain data — its two layers' metatile numbers,
// the objects and the step events — and the changes that can be made to it. No DOM here, so the
// same file runs under Node in the unit test. Plain browser script: defines globals (and
// `module.exports` under Node).
//
// Collision is not stored per cell: in Mana it comes from the metatile (`collision.a/.b` hold the
// 4 bytes of each of a layer's 192 metatiles, $02:A043), so painting a metatile changes the cell's
// picture and its collision together. Step events are a list of {x, y, event} read off the original
// map ($00:B637); editing the list does not change which metatiles the cells hold.
// Evidence for all of it: docs/mana/README.md.

var MANA_ED_MAX_OBJECTS = 0x30;       // a list of $31 or more stops the game ($00:DCE8)
var MANA_ED_DEFAULT_KIND = 0xC001;    // the most common kind word (1350 of 2179 records)

/** The model of the `<hex>.edit.json` data `d`. */
function manaEdModel(d) {
  return {
    id: d.id, w: d.w, h: d.h, sizeB: d.sizeB,
    a: d.a.slice(), b: d.b.slice(),
    origA: d.a.slice(), origB: d.b.slice(),
    collision: d.collision,
    backdrop: d.backdrop,
    steps: (d.events && d.events.steps || []).map(function (s) { return { x: s.x, y: s.y, event: s.event }; }),
    onEnter: d.events ? d.events.onEnter : null,
    objects: (d.objects || []).map(function (o) { return { x: o.x, y: o.y, flags: o.flags, kind: o.kind, bytes: o.bytes.slice() }; }),
    // The event-flag pieces (map changes) and which state of each is showing: a view choice, not an edit.
    pieces: d.pieces || [],
    pieceState: (d.pieces || []).map(function () { return 0; }),
  };
}

function manaEdClone(list) { return JSON.parse(JSON.stringify(list)); }

/** Index of cell (x, y) in a layer's array (layer B repeats with its own size). */
function manaEdIndex(m, layer, x, y) {
  if (layer === 'A') return y * m.w + x;
  return (y % m.sizeB.h) * m.sizeB.w + (x % m.sizeB.w);
}

/** The cell a state of a piece shows at (x, y): {A, B}, or null. A later piece wins over an earlier one. */
function manaEdStateCell(m, x, y) {
  var out = null;
  for (var i = 0; i < m.pieces.length; i++) {
    var s = m.pieceState[i], p = m.pieces[i];
    if (!s) continue;
    var c = p.frames[s - 1] && p.frames[s - 1][(x - p.x) + ',' + (y - p.y)];
    if (c) out = c;
  }
  return out;
}

/**
 * The metatile showing at a cell: what the user painted there, else what the selected state of a piece puts
 * there, else the map's own. (A painted cell wins: the user's edit is on top of any state.)
 */
function manaEdCell(m, layer, x, y) {
  if (layer === 'B' && !m.sizeB) return -1;
  var i = manaEdIndex(m, layer, x, y), arr = layer === 'A' ? m.a : m.b, orig = layer === 'A' ? m.origA : m.origB;
  if (arr[i] !== orig[i]) return arr[i];
  var st = manaEdStateCell(m, x, y);
  return st && st[layer] >= 0 ? st[layer] : arr[i];
}

/** The box of the cells a piece's state changes, inside the piece's area: {dx, dy, w, h, count}, or null. */
function manaEdFrameBounds(piece, s) {
  var f = piece.frames[s - 1];
  var keys = f ? Object.keys(f) : [];
  if (!keys.length) return null;
  var xs = keys.map(function (k) { return Number(k.split(',')[0]); }), ys = keys.map(function (k) { return Number(k.split(',')[1]); });
  var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
  return { dx: x0, dy: y0, w: Math.max.apply(null, xs) - x0 + 1, h: Math.max.apply(null, ys) - y0 + 1, count: keys.length };
}

/** The topmost piece whose area holds the cell, or -1. */
function manaEdPieceAt(m, x, y) {
  for (var i = m.pieces.length - 1; i >= 0; i--) {
    var p = m.pieces[i];
    if (x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h) return i;
  }
  return -1;
}

/** The 4 collision bytes of metatile `n` of `layer`, or zeros past the 192. */
function manaEdTileCollision(m, layer, n) {
  var src = layer === 'A' ? m.collision.a : m.collision.b;
  return n >= 0 && n < 192 ? [src[n * 4], src[n * 4 + 1], src[n * 4 + 2], src[n * 4 + 3]] : [0, 0, 0, 0];
}

/** Floor class 0-3, diagonal 4-7 or 0, level switch and special kind of collision bytes (src/mana/collision.ts). */
function manaEdDecodeCollision(c) {
  var f = c[0] & 7;
  return { floor: f < 4 ? f : 0, diagonal: (c[2] & 0xF0) === 0x10 && (c[2] & 7) >= 4 ? c[2] & 7 : 0,
    switches: (c[0] & 8) !== 0, special: c[1] & 0x80 ? c[1] : 0 };
}

/** Layer A's collision as the overlay draws it ({w, h, floor, diagonal, switches, specials}). */
function manaEdCollisionView(m) {
  var floor = '', diagonal = '', switches = [], specials = [];
  for (var y = 0; y < m.h; y++) {
    for (var x = 0; x < m.w; x++) {
      var d = manaEdDecodeCollision(manaEdTileCollision(m, 'A', manaEdCell(m, 'A', x, y)));
      floor += d.floor; diagonal += d.diagonal;
      if (d.switches) switches.push([x, y]);
      if (d.special) specials.push({ x: x, y: y, kind: d.special });
    }
  }
  return { w: m.w, h: m.h, floor: floor, diagonal: diagonal, switches: switches, specials: specials };
}

/** Whether the user painted this cell (a selected state does not count: that is a view, not an edit). */
function manaEdCellEdited(m, x, y) {
  if (m.a[y * m.w + x] !== m.origA[y * m.w + x]) return true;
  if (!m.sizeB) return false;
  var j = manaEdIndex(m, 'B', x, y);
  return m.b[j] !== m.origB[j];
}

/** Whether the cell is drawn differently from how the map opened: painted over, or changed by a selected state. */
function manaEdCellChanged(m, x, y) {
  var i = y * m.w + x;
  if (m.a[i] !== m.origA[i]) return true;
  if (m.sizeB) {
    var j = manaEdIndex(m, 'B', x, y);
    if (m.b[j] !== m.origB[j]) return true;
  }
  return !!manaEdStateCell(m, x, y);
}

/**
 * Set a cell to metatile `n`. Returns the change to record, or null when nothing changes (or `n`
 * is not one of the layer's 192, or layer B does not exist).
 */
function manaEdSetCell(m, layer, x, y, n) {
  if (n < 0 || n > 191 || x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
  if (layer === 'B' && !m.sizeB) return null;
  var i = manaEdIndex(m, layer, x, y), arr = layer === 'A' ? m.a : m.b;
  if (arr[i] === n) return null;
  var change = { k: 'cell', layer: layer, i: i, before: arr[i], after: n };
  arr[i] = n;
  return change;
}

/** Apply (`which` 'after') or revert ('before') a recorded change; returns the cells to redraw or null for "all". */
function manaEdApply(m, change, which) {
  if (change.k === 'cell') {
    (change.layer === 'A' ? m.a : m.b)[change.i] = change[which];
    return change.layer === 'A' ? [{ x: change.i % m.w, y: Math.floor(change.i / m.w) }] : null;
  }
  if (change.k === 'objects') m.objects = manaEdClone(change[which]);
  if (change.k === 'steps') m.steps = manaEdClone(change[which]);
  return [];
}

/** A new object at a cell: a copy of `like`'s bytes when given (kind and unnamed bytes kept), else the commonest kind. */
function manaEdNewObject(x, y, like) {
  var bytes = like ? like.bytes.slice() : [0, 0, 0, 0, 0, 0, MANA_ED_DEFAULT_KIND & 255, MANA_ED_DEFAULT_KIND >> 8];
  var o = { x: x, y: y, flags: like ? like.flags : 0, kind: like ? like.kind : MANA_ED_DEFAULT_KIND, bytes: bytes };
  manaEdPlaceObject(o, x, y);
  return o;
}

/** Move an object to a cell, keeping the flag bits that share its position bytes (bytes 2 and 3). */
function manaEdPlaceObject(o, x, y) {
  o.x = x; o.y = y;
  o.bytes[2] = (o.bytes[2] & 0x80) | (x & 0x7F);
  o.bytes[3] = (o.bytes[3] & 0x80) | (y & 0x7F);
}

/** Set an object's kind word (bytes 6 and 7). */
function manaEdSetKind(o, kind) {
  o.kind = kind & 0xFFFF;
  o.bytes[6] = o.kind & 255;
  o.bytes[7] = o.kind >> 8;
}

function manaEdObjectAt(m, x, y) {
  for (var i = m.objects.length - 1; i >= 0; i--) if (m.objects[i].x === x && m.objects[i].y === y) return i;
  return -1;
}

/** Every record on a cell, in list order (several can stand on one: the game spawns what its flags allow). */
function manaEdObjectsAt(m, x, y) {
  var out = [];
  for (var i = 0; i < m.objects.length; i++) if (m.objects[i].x === x && m.objects[i].y === y) out.push(i);
  return out;
}

function manaEdStepAt(m, x, y) {
  for (var i = 0; i < m.steps.length; i++) if (m.steps[i].x === x && m.steps[i].y === y) return i;
  return -1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { manaEdModel: manaEdModel, manaEdSetCell: manaEdSetCell, manaEdApply: manaEdApply, manaEdCell: manaEdCell,
    manaEdTileCollision: manaEdTileCollision, manaEdDecodeCollision: manaEdDecodeCollision, manaEdCollisionView: manaEdCollisionView,
    manaEdCellChanged: manaEdCellChanged, manaEdCellEdited: manaEdCellEdited, manaEdNewObject: manaEdNewObject, manaEdPlaceObject: manaEdPlaceObject, manaEdSetKind: manaEdSetKind,
    manaEdObjectAt: manaEdObjectAt, manaEdObjectsAt: manaEdObjectsAt, manaEdStateCell: manaEdStateCell, manaEdFrameBounds: manaEdFrameBounds, manaEdPieceAt: manaEdPieceAt, manaEdStepAt: manaEdStepAt, manaEdClone: manaEdClone, MANA_ED_MAX_OBJECTS: MANA_ED_MAX_OBJECTS };
}
