// Ownership: animated tiles — a tile that changes over time. In the ROM that
// is a Section 2 channel: it swaps the graphic in one *slot* on a timer
// (docs/map-format/map_animated_tiles.md), so every cell naming the slot
// changes together and a cell has no clock of its own. The Animation tab
// (map-editor-anim-tab.js) lists them; this is the model.
//
// One entry per animated tile (`d.anims`, on the one undo history via
// map-editor-history.js):
//   { uid, slot, frames: [graphic | null per frame], delays: [ticks],
//     init, layer: 'canopy'|'terrain', pal: palette/flip bits of its word,
//     vanilla?: frames locked (vanilla's own cycle) until disbanded,
//     rom?: one of a ROM room's own channels,
//     pending?: [cell keys] placed before frame 0 had a tile }
// A slot animates exactly while an entry names it with frame 0 equal to the
// slot's graphic. A frame picked on its own in the Tile tab's `frames` view
// lands in a slot no entry names, and stays still. One graphic may sit in
// several slots: still, and one per animated tile using it.
//
// An animated tile works once every frame has a tile; until then it is
// drawn as purple frames (`editAnimComplete`) and exported as nothing.
//
// Vanilla's patterns for a cycle are lettered A, B, C… in one global order
// (most-used first, `timings` on the family sheets); a tile's letter is the
// pattern its ticks match, whatever made them.
//
// Owns: _animSel, _animFrame, _animPlaying, _animOff.

/** The open animated tile, the frame its pencil tiles, whether it plays, and the map-wide "off". */
var _animSel = null;
var _animFrame = 0;
var _animPlaying = false;
var _animOff = false;

var ANIM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** The longest a frame holds in the ROM; a longer hold is the same graphic over several frames. */
var ANIM_MAX_TICKS = 127;

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

/** The animated tile on `slot`, or null when the slot is still. */
function editAnimOfSlot(palette, slot) {
  var list = editAnims();
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e.slot === slot && e.frames[0] != null && e.frames[0] === editSlotGraphicId(palette, slot)) return e;
  }
  return null;
}

function editWordAnim(palette, word) {
  if (word == null || word === editBlankCanopy(palette)) return null;
  return editAnimOfSlot(palette, animWordSlot(word));
}

/** The animated tile a stamp's art is (canopy first), or null. */
function editStampAnim(palette, index) {
  var w = index >= 0 ? editStampWords(palette, index) : null;
  if (!w) return null;
  return editWordAnim(palette, w.layer1) || editWordAnim(palette, w.layer2);
}

/** Every frame has a tile. */
function editAnimComplete(e) {
  return e.frames.length > 1 && e.frames.every(function (g) { return g != null; });
}

function editAnimNew(props) {
  var d = editDraft();
  d.animSeq = (d.animSeq || 0) + 1;
  var e = Object.assign({ uid: d.animSeq, slot: null, frames: [null, null], delays: [8, 8], init: 0 }, props || {});
  editAnims().push(e);
  return e;
}

/**
 * Frames that hold one graphic in a row, as one: `[{start, count, graphic,
 * ticks}]`. Vanilla holds a graphic past 127 ticks by repeating it (892:
 * ten frames of 127); the tab shows that as one frame. Empty frames never merge.
 */
function editAnimRuns(e) {
  var out = [];
  e.frames.forEach(function (g, i) {
    var last = out[out.length - 1];
    if (last && g != null && last.graphic === g) { last.count++; last.ticks += e.delays[i]; }
    else out.push({ start: i, count: 1, graphic: g, ticks: e.delays[i] });
  });
  return out;
}

/** The run frame `k` is part of. */
function editAnimRunAt(e, k) {
  return editAnimRuns(e).filter(function (r) { return k >= r.start && k < r.start + r.count; })[0] || null;
}

/** Hold run `r` for `ticks`: as many frames of at most 127 ticks as that takes. */
function editAnimSetRunTicks(e, r, ticks) {
  var run = editAnimRuns(e)[r];
  if (!run) return;
  var parts = [];
  for (var left = Math.max(1, ticks); left > 0; left -= ANIM_MAX_TICKS) parts.push(Math.min(ANIM_MAX_TICKS, left));
  e.frames.splice.apply(e.frames, [run.start, run.count].concat(parts.map(function () { return run.graphic; })));
  e.delays.splice.apply(e.delays, [run.start, run.count].concat(parts));
}

/** A word naming `slot` with an animated tile's palette and mirror bits. */
function animWordFor(e, slot) {
  return (editSlotChr(slot) | ((e.pal || 0) & 0xfc00)) & 0xffff;
}

/**
 * The slot showing `graphic` animated as `spec` (`{frames, delays, init}`,
 * frame 0 being `graphic`): the animated tile with exactly those frames and
 * ticks, else a new one (locked: its frames are vanilla's cycle). This is a
 * ▶ swatch's pick, a widget part's, and the same as placing that animated
 * tile from the Animation tab.
 */
function editAdoptAnimated(palette, graphic, spec, preferUid) {
  if (!spec || !spec.frames || spec.frames.length < 2) return editAdoptGraphic(palette, graphic, null);
  var frames = [graphic].concat(spec.frames.slice(1));
  var key = frames.join(',') + '|' + spec.delays.join(',') + '|' + (spec.init || 0);
  var found = null;
  editAnims().forEach(function (e) {
    if (found || e.slot == null || editAnimOfSlot(palette, e.slot) !== e) return;
    if (e.frames.join(',') + '|' + e.delays.join(',') + '|' + (e.init || 0) === key) found = e;
  });
  var pref = preferUid != null ? editAnimFind(preferUid) : null;
  if (!found && pref && pref.slot != null && pref.frames.join(',') === frames.join(',')) found = pref;
  if (found) return found.slot;
  var e = editAnimNew({ frames: frames, delays: spec.delays.slice(), init: spec.init || 0, vanilla: spec.vanilla !== false });
  var slot = editAdoptGraphic(palette, graphic, e.uid, true);
  if (slot < 0) { editAnims().pop(); return slot; }
  e.slot = slot;
  return slot;
}

/** `{frames, delays, init}` of the animated tile a word shows, for keeping in a widget; null when still or unfinished. */
function editWordAnimSpec(palette, word) {
  var e = editWordAnim(palette, word);
  if (!e || !editAnimComplete(e)) return null;
  return { frames: e.frames.slice(), delays: e.delays.slice(), init: e.init || 0, vanilla: !!e.vanilla };
}

/** uid -> the map cells (keys) showing it: cells naming its slot, and its pending ones. One pass. */
function editAnimCellMap(palette) {
  var out = {};
  var d = editDraft();
  if (!d || !palette || !editAnims().length) return out;
  var bySlot = {};
  editAnims().forEach(function (e) {
    if (e.slot != null && editAnimOfSlot(palette, e.slot) === e) bySlot[e.slot] = e;
    if (e.pending && e.pending.length) out[e.uid] = e.pending.slice();
  });
  var shown = typeof editBakedCells === 'function' ? editBakedCells(palette) : d.cells;
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
      var e = word === editBlankCanopy(palette) ? null : bySlot[animWordSlot(word)];
      if (!e) return;
      var list = out[e.uid] || (out[e.uid] = []);
      if (list[list.length - 1] !== k) list.push(k);
    });
  });
  return out;
}

/** The animated tiles the tab lists: on the map (placed or pending), or open. */
function editAnimsListed(palette) {
  var cells = editAnimCellMap(palette);
  return editAnims().filter(function (e) {
    return (cells[e.uid] || []).length || e.uid === _animSel;
  }).map(function (e) { return { g: e, cells: cells[e.uid] || [] }; });
}

/** A cycle with its rotation taken out, so two phases of one animation read the same. */
function animCycleKey(seq) {
  var at = 0;
  seq.forEach(function (v, i) { if (v < seq[at]) at = i; });
  return seq.slice(at).concat(seq.slice(0, at)).join(',');
}

/** A list turned to start at index `r`. */
function animTurn(xs, r) { return xs.slice(r).concat(xs.slice(0, r)); }

/**
 * Vanilla's patterns for an animated tile's frames, turned to its phase:
 * `[{delays, channels, letter}]` in the global order. Only when vanilla runs
 * exactly this cycle (the family sheets' `animations`, room-draft.js) — a
 * drawn animation of other frames has none.
 */
function editAnimPresets(e) {
  if (!editAnimComplete(e) || typeof _famSheets === 'undefined') return [];
  var seq = e.frames, lo = Math.min.apply(null, seq), key = animCycleKey(seq);
  for (var f in _famSheets) {
    var a = _famSheets[f] && _famSheets[f].animations && _famSheets[f].animations[lo];
    if (!a || a.frames.length !== seq.length || animCycleKey(a.frames) !== key) continue;
    for (var r = 0; r < seq.length; r++) {
      if (animTurn(a.frames, r).join(',') !== seq.join(',')) continue;
      return (a.timings && a.timings.length ? a.timings : [{ delays: a.delays, channels: 0 }]).map(function (t, i) {
        return { delays: animTurn(t.delays, r), channels: t.channels, letter: ANIM_LETTERS[i] || '?' };
      });
    }
  }
  return [];
}

/** The pattern letter an animated tile's ticks match, or null (custom). */
function editAnimLetter(e, presets) {
  var key = e.delays.join(',');
  var list = presets || editAnimPresets(e);
  for (var i = 0; i < list.length; i++) if (list[i].delays.join(',') === key) return list[i].letter;
  return null;
}

/** Every channel the draft runs, for the composed preview and the ROM export: finished tiles only. */
function editAnimChannels(palette) {
  var out = [];
  editAnims().forEach(function (e) {
    if (e.slot == null || !editAnimComplete(e) || editAnimOfSlot(palette, e.slot) !== e) return;
    // Every frame the same graphic: it never changes, so it costs no channel.
    if (e.frames.every(function (g) { return g === e.frames[0]; })) return;
    out.push({ slot: e.slot, frames: e.frames.slice(), delays: e.delays.slice(), init: e.init || 0 });
  });
  return out;
}

/**
 * A ROM room's own channels as animated tiles, once per draft (not an undo
 * step), each locked to its frames and keeping its own timing — the room's
 * timings are data (map-construction skill §5).
 */
function editSeedRoomAnims(palette) {
  var d = editDraft();
  // A flag, not `d.anims`: the list is made on first use, often before the palette is here.
  if (!d || d.blank || d.customKey || d.animsSeeded || d.txn || !palette || palette.customBlank) return;
  if (palette.roomId != null && palette.roomId !== d.roomId) return;
  if (!Array.isArray(palette.channels) || !palette.grid) return;
  d.animsSeeded = true;
  editAnims();
  palette.channels.forEach(function (c) {
    if (!c[2] || c[2].length < 2) return;
    var e = editAnimNew({ slot: c[0], init: c[1] || 0, rom: true, vanilla: true,
      frames: c[2].map(function (f) { return f[0]; }), delays: c[2].map(function (f) { return f[1]; }) });
    // Its layer and word bits, off the first cell naming it.
    palette.grid.some(function (row) {
      return row.some(function (idx) {
        var w = idx >= 0 ? editStampWords(palette, idx) : null;
        if (!w) return false;
        if (animWordSlot(w.layer1) === c[0] && w.layer1 !== editBlankCanopy(palette)) { e.layer = 'canopy'; e.pal = w.layer1 & 0xfc00; return true; }
        if (animWordSlot(w.layer2) === c[0]) { e.layer = 'terrain'; e.pal = w.layer2 & 0xfc00; return true; }
        return false;
      });
    });
  });
}

/** The frame a stamp shows on the canvas (map-editor-anim.js): 0 while animation is off, the open tile's frame while paused; -1 plays. */
function editAnimShownFrame(palette, index) {
  if (_animOff) return 0;
  if (_animPlaying || _animSel == null) return -1;
  var e = editStampAnim(palette, index);
  return e && e.uid === _animSel ? _animFrame : -1;
}

/** The timing a stamp is drawn with on the canvas: its animated tile's, which the tab edits without a new render. */
function editAnimTimingOf(palette, index) {
  var e = editStampAnim(palette, index);
  return e ? { delays: e.delays, init: e.init || 0 } : null;
}

/** Animation on or off, map-wide; saved with the UI prefs. */
function editAnimToggleOff() {
  _animOff = !_animOff;
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: 'animateTiles', value: !_animOff });
}
