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
function editAnimRuns(e) {
  var ms = editAnimMembers(e), out = [];
  e.frames.forEach(function (g, i) {
    var last = out[out.length - 1];
    var same = last && ms.every(function (m) { return m.frames[i] != null && m.frames[i] === m.frames[i - 1]; });
    if (same) { last.count++; last.ticks += e.delays[i]; } else out.push({ start: i, count: 1, graphic: g, ticks: e.delays[i] });
  });
  return out;
}

/** The run frame `k` is part of. */
function editAnimRunAt(e, k) {
  return editAnimRuns(e).filter(function (r) { return k >= r.start && k < r.start + r.count; })[0] || null;
}

/** Hold run `r` for `ticks`, in every member: as many frames of at most 127 ticks as that takes. */
function editAnimSetRunTicks(e, r, ticks) {
  var run = editAnimRuns(e)[r];
  if (!run) return;
  var parts = [];
  for (var left = Math.max(1, ticks); left > 0; left -= ANIM_MAX_TICKS) parts.push(Math.min(ANIM_MAX_TICKS, left));
  editAnimMembers(e).forEach(function (m) {
    var g = m.frames[run.start];
    m.frames.splice.apply(m.frames, [run.start, run.count].concat(parts.map(function () { return g; })));
    m.delays.splice.apply(m.delays, [run.start, run.count].concat(parts));
  });
}

/** Every member complete. */
function editAnimSetComplete(e) {
  return editAnimMembers(e).every(editAnimComplete);
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
 * What the tab lists: every placement — each run of touching cells showing
 * a tile or a set — so a tile used ten times is ten rows, sharing frames and
 * ticks. `{g, members, of: {cell: member}, cells, part, parts}`. An open
 * one with no cells yet is one row.
 */
function editAnimsListed(palette) {
  var cells = editAnimCellMap(palette), out = [], done = {};
  editAnims().forEach(function (e) {
    var key = e.set != null ? 's' + e.set : 'u' + e.uid;
    if (done[key]) return;
    done[key] = true;
    var members = editAnimMembers(e), of = {}, all = [];
    members.forEach(function (m) {
      (cells[m.uid] || []).forEach(function (k) { if (!of[k]) { of[k] = m; all.push(k); } });
    });
    var parts = animClusters(all);
    if (!parts.length && members.some(function (m) { return m.uid === _animSel; })) parts = [[]];
    parts.forEach(function (c, i) { out.push({ g: e, members: members, of: of, cells: c, part: i, parts: parts.length }); });
  });
  return out;
}

/** Cell keys split into runs of side-by-side cells, in reading order. */
function animClusters(keys) {
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
        if (left[n]) { delete left[n]; todo.push(n); }
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
