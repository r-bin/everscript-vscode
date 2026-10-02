// Ownership: animated tiles taken together — a *set* (several cells drawn as
// one, a 2×2 fan: one animated tile per cell, sharing their timing), the
// frames a set holds one graphic over (runs), what the Animation tab lists
// (every placement), and copying a placement to paste it elsewhere. The
// single tile is map-editor-animations.js.
//
// A set is the entries with the same `set` number. Each is its own channel —
// each cell of a fan changes to its own graphic — but their frames line up
// and their ticks, countdown and frame count are one: a pattern, a tick or
// `+ Frame` on the set changes every member. A tile with no `set` is a set of
// one.
//
// Owns: _animClip.

/** The copied placement: `{w, h, cells: [{dx, dy, uid}]}`, or null. */
var _animClip = null;

/** The animated tiles drawn with `e` as one (itself included), in drawing order. */
function editAnimMembers(e) {
  if (!e || e.set == null) return e ? [e] : [];
  return editAnims().filter(function (x) { return x.set === e.set; });
}

/**
 * Frames holding one graphic in a row, in every member at once, as one:
 * `[{start, count, graphic, ticks}]` (`graphic` is `e`'s). Vanilla holds a
 * graphic past 127 ticks by repeating it (892: ten frames of 127); the tab
 * shows that as one frame. Empty frames never merge.
 */
function editAnimRuns(e, members) {
  var ms = members || editAnimMembers(e), out = [];
  e.frames.forEach(function (g, i) {
    var last = out[out.length - 1];
    var same = last && ms.every(function (m) { return m.frames[i] != null && m.frames[i] === m.frames[i - 1]; });
    if (same) { last.count++; last.ticks += e.delays[i]; } else out.push({ start: i, count: 1, graphic: g, ticks: e.delays[i] });
  });
  return out;
}

/** The run frame `k` is part of. */
function editAnimRunAt(e, k, members) {
  return editAnimRuns(e, members).filter(function (r) { return k >= r.start && k < r.start + r.count; })[0] || null;
}

/** Hold run `r` for `ticks`, in every member: as many frames of at most 127 ticks as that takes. */
function editAnimSetRunTicks(e, r, ticks, members) {
  var run = editAnimRuns(e, members)[r];
  if (!run) return;
  var parts = [];
  for (var left = Math.max(1, ticks); left > 0; left -= ANIM_MAX_TICKS) parts.push(Math.min(ANIM_MAX_TICKS, left));
  (members || editAnimMembers(e)).forEach(function (m) {
    var g = m.frames[run.start];
    m.frames.splice.apply(m.frames, [run.start, run.count].concat(parts.map(function () { return g; })));
    m.delays.splice.apply(m.delays, [run.start, run.count].concat(parts));
  });
}

/** Every member complete. */
function editAnimSetComplete(e, members) {
  return (members || editAnimMembers(e)).every(editAnimComplete);
}

/**
 * The tiles an edit of `e` changes together: the open row's, when `e` is in
 * it (tiles side by side on one pattern), with their sets; else its set.
 */
/**
 * `{uid: true}` of the open row's tiles. Asked once per stamp drawn, so kept
 * until the open tile, the history or the list changes.
 */
function editAnimOpenUids() {
  var d = editDraft();
  var key = _animSel + '|' + (d ? d.undo.length + ',' + d.redo.length : '') + '|' + editAnims().length;
  if (_animOpenMemo.key !== key) {
    var out = {};
    editAnimGroup(editAnimFind(_animSel)).forEach(function (m) { out[m.uid] = true; });
    _animOpenMemo = { key: key, uids: out };
  }
  return _animOpenMemo.uids;
}
var _animOpenMemo = { key: null, uids: {} };

function editAnimGroup(e) {
  if (!e) return [];
  var open = _mtPalette ? animOpenEntry(editAnimsListed(_mtPalette)) : null;
  var ms = open && open.members.indexOf(e) >= 0 ? open.members.slice() : [e];
  ms.slice().forEach(function (m) { editAnimMembers(m).forEach(function (x) { if (ms.indexOf(x) < 0) ms.push(x); }); });
  return ms;
}

/**
 * New animated tiles on every cell of a rectangle, drawn as one set (one
 * cell: a plain tile): two empty frames each, pending until tiled. Returns
 * the first.
 */
function editAnimNewSet(x1, y1, x2, y2) {
  var d = editDraft(), set = null, first = null;
  if (x1 !== x2 || y1 !== y2) { d.animSetSeq = (d.animSetSeq || 0) + 1; set = d.animSetSeq; }
  for (var y = y1; y <= y2; y++) {
    for (var x = x1; x <= x2; x++) {
      var e = editAnimNew(set != null ? { set: set } : {});
      e.pending = [editKey(x, y)];
      if (!first) first = e;
    }
  }
  return first;
}

/**
 * What the tab lists: every placement. Cells side by side join one row when
 * they are one tile, one set, or finished tiles running the same pattern —
 * the same ticks from the same start, so they stay in step (a torch's flame
 * over its base, a lava pool). A tile used ten times apart is ten rows.
 * `{g, members, of: {cell: tile}, cells, part, parts}`; an open tile with no
 * cells yet is one row.
 */
function editAnimsListed(palette) {
  // Asked by the tab, every map redraw on every tab (the marks) and every edit: kept until the draft changes.
  var sig = animListSig(palette);
  if (_animListMemo.sig === sig) return _animListMemo.out;
  var out = animListBuild(palette);
  _animListMemo = { sig: sig, out: out };
  return out;
}
var _animListMemo = { sig: null, out: [] };

/** What the list depends on, cheaply: the tiles, the open one, and how far the history and the open gesture have got. */
function animListSig(palette) {
  var d = editDraft();
  if (!d) return null;
  var step = d.txn && d.txn.step;
  return [palette && palette.roomId, palette && palette.count, _animSel, d.undo.length, d.redo.length,
    step ? step.cells.length : -1, (d.groups || []).length, Object.keys(d.cells).length].join(',') + '|'
    + editAnims().map(function (e) {
      return e.uid + ':' + e.slot + ':' + e.set + ':' + e.frames.join('.') + ':' + e.delays.join('.') + ':' + (e.init || 0) + ':' + (e.pending || []).join(';');
    }).join('|');
}

function animListBuild(palette) {
  var cells = editAnimCellMap(palette), of = {}, keys = [];
  editAnims().forEach(function (e) {
    (cells[e.uid] || []).forEach(function (k) { if (!of[k]) { of[k] = e; keys.push(k); } });
  });
  var timing = function (e) { return editAnimComplete(e) ? e.delays.join(',') + '|' + (e.init || 0) : null; };
  var joins = function (a, b) {
    return a === b || (a.set != null && a.set === b.set) || (timing(a) != null && timing(a) === timing(b));
  };
  var out = [], seen = {}, partsOf = {};
  animClusters(keys, function (k, n) { return joins(of[k], of[n]); }).forEach(function (c) {
    var members = [];
    c.forEach(function (k) { if (members.indexOf(of[k]) < 0) members.push(of[k]); });
    var g = members[0], key = g.set != null ? 's' + g.set : 'u' + g.uid;
    partsOf[key] = (partsOf[key] || 0) + 1;
    members.forEach(function (m) { seen[m.uid] = true; });
    out.push({ g: g, members: members, of: of, cells: c, part: partsOf[key] - 1, key: key });
  });
  out.forEach(function (x) { x.parts = partsOf[x.key]; });
  // Open, with no cells yet (a new tile before it is placed).
  var sel = editAnimFind(_animSel);
  if (sel && !seen[sel.uid]) out.push({ g: sel, members: editAnimMembers(sel), of: of, cells: [], part: 0, parts: 1, key: 'u' + sel.uid });
  return out;
}

/** Cell keys split into runs of side-by-side cells (`joins(a, b)` too, when given), in reading order. */
function animClusters(keys, joins) {
  var left = {}, out = [];
  keys.forEach(function (k) { left[k] = true; });
  keys.forEach(function (k) {
    if (!left[k]) return;
    var part = [], todo = [k];
    delete left[k];
    while (todo.length) {
      var c = todo.pop(), xy = c.split(',').map(Number);
      part.push(c);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var n = (xy[0] + d[0]) + ',' + (xy[1] + d[1]);
        if (left[n] && (!joins || joins(c, n))) { delete left[n]; todo.push(n); }
      });
    }
    out.push(part);
  });
  return out;
}

/** The open row among `listed`: its set holds `_animSel`, and `_animSelPart` is one of its cells (else its first). */
function animOpenEntry(listed) {
  var mine = listed.filter(function (x) { return x.members.some(function (m) { return m.uid === _animSel; }); });
  var at = typeof _animSelPart !== 'undefined' && _animSelPart != null
    ? mine.filter(function (x) { return x.cells.indexOf(_animSelPart) >= 0; })[0] : null;
  return at || mine[0] || null;
}

// ── copy and paste ────────────────────────────────────────────────────────

/** Cmd/Ctrl+C / +V on the Animation tab: the open placement, pasted at the pointer. True when handled. */
function animClipboardKey(e, mod) {
  if (!mod || typeof editDrawKind !== 'function' || editDrawKind() !== 'anim' || !_mtPalette) return false;
  var key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'c') {
    var open = animOpenEntry(editAnimsListed(_mtPalette));
    if (!open || !open.cells.length) return false;
    var xy = open.cells.map(function (k) { return k.split(',').map(Number); });
    var x0 = Math.min.apply(null, xy.map(function (c) { return c[0]; })), y0 = Math.min.apply(null, xy.map(function (c) { return c[1]; }));
    _animClip = { w: Math.max.apply(null, xy.map(function (c) { return c[0]; })) - x0 + 1,
      h: Math.max.apply(null, xy.map(function (c) { return c[1]; })) - y0 + 1,
      cells: xy.map(function (c, i) { return { dx: c[0] - x0, dy: c[1] - y0, uid: open.of[open.cells[i]].uid }; }) };
    editNote('copied the animated tile (' + _animClip.w + '×' + _animClip.h + ') — Cmd/Ctrl+V puts a copy where the pointer is');
    renderEditChrome();
    return true;
  }
  if (key === 'v' && _animClip) {
    if (editLocked()) { editNote('this map is locked — unlock it to paste'); renderEditChrome(); return true; }
    var h = typeof _editHover !== 'undefined' && _editHover ? _editHover : { x: 0, y: 0 };
    editBegin();
    _animClip.cells.forEach(function (c) {
      var m = editAnimFind(c.uid), at = { x: h.x + c.dx, y: h.y + c.dy };
      if (m && editInBounds(_mtPalette, at.x, at.y)) animPlace(m, at);
    });
    editEnd();
    _animSelPart = editKey(h.x, h.y);
    editNote('pasted — the copy changes together with the original');
    animRedraw();
    return true;
  }
  return false;
}
