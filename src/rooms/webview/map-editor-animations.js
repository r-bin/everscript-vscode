// Ownership: animations — which tile slots a Section 2 channel drives, and
// the groups the Animation tab lists (map-editor-anim-tab.js draws them).
//
// In the game a channel swaps the graphic in one *slot* on a timer
// (docs/map-format/map_animated_tiles.md), so every cell naming that slot
// moves together, and a tile has no clock of its own. The editor keeps it
// the same way: a slot is animated exactly while a group lists it. A frame
// picked on its own in the Tile tab's `frames` mode lands in a slot no group
// lists, and stays still — before, any graphic vanilla animates played.
// One graphic can sit in several slots: a still copy, and one per timing
// (vanilla runs graphic 2389 on two channels in room 0x16).
//
// A group (`d.anims`, on the one undo history via map-editor-history.js):
//   { uid, delays: [ticks per frame], init: initial countdown,
//     channels: { slot: [graphic per frame] }, auto?, rom? }
// Every channel in a group shares its timing; frame 0 of a channel is the
// graphic its slot holds, and a binding whose frame 0 no longer matches the
// slot (a pruned slot reused) counts as none.
//   - auto: brought in by placing a ▶ tile or a widget; listed while a cell
//     shows it, kept (with its slots) so undo can bring the cells back.
//   - rom: one of a ROM room's own channels, grouped by editSeedRoomAnims.
//   - neither: drawn with the Animation tab's pencil — `area` is the
//     rectangle it was dragged out over; its tiles are painted frame by frame.
// Groups of one animation (the same cycles) are its *timings*, lettered A, B,
// C…: the tab lists one row per animation with its timings as chips.
//
// Owns: _animSel, _animFrame, _animPlaying.

/** The group (timing) the Animation tab has open, the frame its pencil draws into, and whether it plays. */
var _animSel = null;
var _animFrame = 0;
var _animPlaying = false;

var ANIM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function editAnims() {
  var d = editDraft();
  if (!d) return [];
  if (!d.anims) d.anims = [];
  return d.anims;
}

function editAnimFind(uid) {
  var list = editAnims();
  for (var i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

/** The slot a tilemap word draws (the same sum as maps/custom-animation.ts wordSlot). */
function animWordSlot(word) {
  var chr = word & 0x3ff;
  return (chr >> 5) * 8 + ((chr & 0x1f) >> 1);
}

/** The graphic a slot holds: the room's tile list, then the draft's adoptions. */
function editSlotGraphicId(palette, slot) {
  var n = palette && palette.tiles ? palette.tiles.count : 0;
  if (slot < n) return palette.tiles.slots[slot][2];
  var d = editDraft();
  return d && d.addedGraphics ? d.addedGraphics[slot - n] : undefined;
}

/** The group that drives `slot`, or null when the slot is still. */
function editAnimOfSlot(palette, slot) {
  var list = editAnims();
  for (var i = 0; i < list.length; i++) {
    var seq = list[i].channels[slot];
    if (seq && seq.length && seq[0] === editSlotGraphicId(palette, slot)) return list[i];
  }
  return null;
}

/** The group a stamp's art moves with (canopy first), or null. */
function editStampAnim(palette, index) {
  var w = index >= 0 ? editStampWords(palette, index) : null;
  if (!w) return null;
  return editWordAnim(palette, w.layer1) || editWordAnim(palette, w.layer2);
}

function editWordAnim(palette, word) {
  if (word == null || word === editBlankCanopy(palette)) return null;
  return editAnimOfSlot(palette, animWordSlot(word));
}

function animTimingKey(delays, init) {
  return (delays || []).join(',') + '|' + (init || 0);
}

function editAnimNew(delays, init, flags) {
  var d = editDraft();
  d.animSeq = (d.animSeq || 0) + 1;
  var g = Object.assign({ uid: d.animSeq, delays: delays.slice(), init: init || 0, channels: {} }, flags || {});
  editAnims().push(g);
  return g;
}

/**
 * The group a spec `{frames, delays, init}` joins: the one asked for when it
 * has that timing, else one that already runs this cycle at that timing,
 * else an auto group with that timing, else a new auto group.
 */
function editAnimForSpec(spec, preferUid) {
  var key = animTimingKey(spec.delays, spec.init);
  var list = editAnims();
  var pref = preferUid != null ? editAnimFind(preferUid) : null;
  if (pref && animTimingKey(pref.delays, pref.init) === key) return pref;
  // The open timing of the same animation: picked tiles join it, whatever its ticks.
  var cyc = animCycleKey(spec.frames || []);
  if (pref && pref.delays.length === (spec.frames || []).length
    && Object.keys(pref.channels).some(function (sl) { return animCycleKey(pref.channels[sl]) === cyc; })) return pref;
  var seqKey = (spec.frames || []).join(',');
  var same = list.filter(function (g) { return !g.rom && animTimingKey(g.delays, g.init) === key; });
  for (var i = 0; i < same.length; i++) {
    var ch = same[i].channels;
    for (var s in ch) if (ch[s].join(',') === seqKey) return same[i];
  }
  for (var j = 0; j < same.length; j++) if (same[j].auto) return same[j];
  return editAnimNew(spec.delays, spec.init, { auto: true });
}

/**
 * A slot showing `graphic` animated as `spec` (`{frames, delays, init}`,
 * frame 0 being `graphic`). Adopts the graphic into a slot of its own for
 * that group when it has none.
 */
function editAdoptAnimated(palette, graphic, spec, preferUid) {
  if (!spec || !spec.frames || spec.frames.length < 2) return editAdoptGraphic(palette, graphic, null);
  var g = editAnimForSpec(spec, preferUid);
  var slot = editAdoptGraphic(palette, graphic, g.uid);
  if (slot >= 0) g.channels[slot] = [graphic].concat(spec.frames.slice(1, g.delays.length));
  while (slot >= 0 && g.channels[slot].length < g.delays.length) g.channels[slot].push(graphic);
  return slot;
}

/** `{frames, delays, init}` of the channel a word's slot is on, for keeping in a widget; null when still. */
function editWordAnimSpec(palette, word) {
  var g = editWordAnim(palette, word);
  if (!g) return null;
  return { frames: g.channels[animWordSlot(word)].slice(), delays: g.delays.slice(), init: g.init || 0 };
}

/** uid -> the map cells (keys) whose shown words name one of its slots. One pass. */
function editAnimCellMap(palette) {
  var out = {};
  var d = editDraft();
  if (!d || !palette || !editAnims().length) return out;
  var shown = typeof editBakedCells === 'function' ? editBakedCells(palette) : d.cells;
  var bySlot = {};
  var keys = Object.keys(shown);
  if (palette.grid) {
    for (var y = 0; y < palette.grid.length; y++) {
      for (var x = 0; x < palette.grid[y].length; x++) {
        var k0 = editKey(x, y);
        if (!Object.prototype.hasOwnProperty.call(shown, k0)) keys.push(k0);
      }
    }
  }
  keys.forEach(function (k) {
    var p = k.split(',').map(Number);
    var idx = Object.prototype.hasOwnProperty.call(shown, k) ? shown[k] : editCellAt(palette, p[0], p[1]);
    var w = idx >= 0 ? editStampWords(palette, idx) : null;
    if (!w) return;
    [w.layer1, w.layer2].forEach(function (word) {
      if (word === editBlankCanopy(palette)) return;
      var s = animWordSlot(word);
      if (!(s in bySlot)) bySlot[s] = editAnimOfSlot(palette, s);
      var g = bySlot[s];
      if (!g) return;
      var list = out[g.uid] || (out[g.uid] = []);
      if (list[list.length - 1] !== k) list.push(k);
    });
  });
  return out;
}

/**
 * The tab's rows: one per animation, its timings (groups showing the same
 * cycles) in the order they came, each with the cells it drives. A drawn
 * group with nothing painted yet is a row of its own.
 */
function editAnimRows(palette) {
  var rows = [], byKey = {};
  editAnimsListed(palette).forEach(function (e) {
    var k = animKind(e.g) || ('new-' + e.g.uid);
    if (!byKey[k]) { byKey[k] = { key: k, timings: [] }; rows.push(byKey[k]); }
    byKey[k].timings.push(e);
  });
  return rows;
}

/** A list turned to start at index `r`. */
function animTurn(xs, r) { return xs.slice(r).concat(xs.slice(0, r)); }

/**
 * Vanilla's timings for a group's animation, turned to the group's phase:
 * `[{delays, channels}]`, most-used first. Only when vanilla runs exactly
 * this cycle (from the family sheets' `animations`, room-draft.js) — a drawn
 * animation of other frames has none.
 */
function editAnimPresets(g) {
  var slots = Object.keys(g.channels);
  if (!slots.length || typeof _famSheets === 'undefined') return [];
  var seq = g.channels[slots[0]];
  var lo = Math.min.apply(null, seq), key = animCycleKey(seq);
  for (var f in _famSheets) {
    var a = _famSheets[f] && _famSheets[f].animations && _famSheets[f].animations[lo];
    if (!a || a.frames.length !== seq.length || animCycleKey(a.frames) !== key) continue;
    for (var r = 0; r < seq.length; r++) {
      if (animTurn(a.frames, r).join(',') !== seq.join(',')) continue;
      return (a.timings && a.timings.length ? a.timings : [{ delays: a.delays, channels: 0 }]).map(function (t) {
        return { delays: animTurn(t.delays, r), channels: t.channels };
      });
    }
  }
  return [];
}

/** The frame an open, paused timing shows on the canvas (map-editor-anim.js), or -1 to play. */
function editAnimShownFrame(palette, index) {
  if (_animPlaying || _animSel == null) return -1;
  var g = editStampAnim(palette, index);
  return g && g.uid === _animSel ? _animFrame : -1;
}

/** The groups the tab lists: on the map, drawn by hand, or open. */
function editAnimsListed(palette) {
  var cells = editAnimCellMap(palette);
  return editAnims().filter(function (g) {
    return (cells[g.uid] || []).length || (!g.auto && !g.rom) || g.uid === _animSel;
  }).map(function (g) { return { g: g, cells: cells[g.uid] || [] }; });
}

/** A cycle with its rotation taken out, so two phases of one animation read the same. */
function animCycleKey(seq) {
  var at = 0;
  seq.forEach(function (v, i) { if (v < seq[at]) at = i; });
  return seq.slice(at).concat(seq.slice(0, at)).join(',');
}

/** What a group shows, phase aside: its channels' cycles. */
function animKind(g) {
  return Object.keys(g.channels).map(function (s) { return animCycleKey(g.channels[s]); }).sort().join('|');
}

/**
 * uid -> its timing letter: A, B, C… among the listed groups that show the
 * same animation, in the order they came. Groups of one animation differ
 * only in timing (delays, start frame or countdown), so the letter is all
 * the Placed list and the rows need to tell them apart.
 */
function editAnimLetters(listed) {
  var byKind = {};
  var out = {};
  listed.forEach(function (e) {
    var k = animKind(e.g);
    byKind[k] = (byKind[k] || 0);
    out[e.g.uid] = ANIM_LETTERS[byKind[k]] || '?';
    byKind[k] += 1;
  });
  return out;
}

/** Every channel the draft runs, for the composed preview and the ROM export: `{slot, frames, delays, init}`. */
function editAnimChannels(palette) {
  var out = [];
  editAnims().forEach(function (g) {
    Object.keys(g.channels).forEach(function (k) {
      var slot = Number(k);
      var seq = g.channels[k];
      if (!seq || seq.length < 2 || seq[0] !== editSlotGraphicId(palette, slot)) return;
      // Every frame the same graphic: it never changes, so it costs no channel.
      if (seq.every(function (gr) { return gr === seq[0]; })) return;
      out.push({ slot: slot, frames: seq.slice(), delays: g.delays.slice(), init: g.init || 0 });
    });
  });
  return out;
}

/**
 * A ROM room's own channels as groups, once per draft (not an undo step):
 * channels whose cells touch and that share a timing are one group — the
 * two halves of a torch, a pool of water — and the same animation at
 * another timing is another group, its timing letter telling them apart.
 */
function editSeedRoomAnims(palette) {
  var d = editDraft();
  // A flag, not `d.anims`: the list is made on first use, often before the palette is here.
  if (!d || d.blank || d.customKey || d.animsSeeded || d.txn || !palette || palette.customBlank) return;
  if (palette.roomId != null && palette.roomId !== d.roomId) return;
  if (!Array.isArray(palette.channels) || !palette.grid) return;
  d.animsSeeded = true;
  var chans = palette.channels.map(function (c) {
    return { slot: c[0], init: c[1] || 0, seq: c[2].map(function (f) { return f[0]; }), delays: c[2].map(function (f) { return f[1]; }) };
  }).filter(function (c) { return c.seq.length > 1; });
  if (!d.anims) d.anims = [];
  if (!chans.length) return;
  var bySlot = {};
  chans.forEach(function (c, i) { bySlot[c.slot] = i; c.key = animTimingKey(c.delays, c.init); });
  var at = {};
  palette.grid.forEach(function (row, y) {
    row.forEach(function (idx, x) {
      var w = idx >= 0 ? editStampWords(palette, idx) : null;
      if (!w) return;
      [w.layer1, w.layer2].forEach(function (word) {
        var i = bySlot[animWordSlot(word)];
        if (i === undefined) return;
        (at[x + ',' + y] || (at[x + ',' + y] = [])).push(i);
      });
    });
  });
  var parent = chans.map(function (_, i) { return i; });
  var root = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  var join = function (a, b) { if (chans[a].key === chans[b].key) parent[root(a)] = root(b); };
  Object.keys(at).forEach(function (k) {
    var p = k.split(',').map(Number);
    var here = at[k];
    [[0, 0], [1, 0], [0, 1]].forEach(function (o) {
      var there = at[(p[0] + o[0]) + ',' + (p[1] + o[1])];
      if (there) here.forEach(function (a) { there.forEach(function (b) { join(a, b); }); });
    });
  });
  var groups = {};
  chans.forEach(function (c, i) {
    var r = root(i);
    var g = groups[r] || (groups[r] = editAnimNew(c.delays, c.init, { rom: true }));
    g.channels[c.slot] = c.seq.slice();
  });
}

/**
 * The timing a stamp is drawn with on the canvas (map-editor-anim.js):
 * its group's, which the timing editor changes without a new render.
 */
function editAnimTimingOf(palette, index) {
  var g = editStampAnim(palette, index);
  return g ? { delays: g.delays, init: g.init || 0 } : null;
}

