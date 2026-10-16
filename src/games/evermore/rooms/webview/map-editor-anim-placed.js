// Ownership: a placed widget's pattern — the Placed list's A/B/C chips
// (map-editor-placed-list.js shows them) and moving one placed widget's
// animated tiles onto another of vanilla's patterns. The model is
// map-editor-animations.js.
//
// An animated tile is one channel, and every cell showing it changes
// together: switching one placed widget to pattern B moves its words onto an
// animated tile with B's ticks (found or made), so the map's other copies
// keep theirs.
//
// Owns: nothing.

/** The first finished animated tile a placed group's words show, or null. */
function placedAnimOf(g) {
  var out = null;
  (g.cells || []).some(function (c) {
    return [c.layer1, c.layer2].some(function (word) {
      var e = word == null ? null : editWordAnim(_mtPalette, word);
      if (e && editAnimComplete(e)) out = e;
      return !!out;
    });
  });
  return out;
}

/** The pattern chips for a placed widget whose tiles move: vanilla's letters for its frames. */
function placedTimingHtml(g) {
  if (!_mtPalette) return '';
  var e = placedAnimOf(g);
  var presets = e ? editAnimPresets(e) : [];
  if (presets.length < 2) return '';
  var cur = editAnimLetter(e, presets);
  return '<div class="rg-anim-timing-chips"><span class="rg-anim-timing-lbl">pattern</span>'
    + presets.map(function (t, i) {
      return '<button class="ro-chip rg-anim-letter-chip' + (t.letter === cur ? ' sel' : '') + '" data-anim-timing="' + i
        + '" data-anim-group="' + g.uid + '" title="' + escH('vanilla’s pattern ' + t.letter + ': ' + t.delays.join(' ') + ' ticks') + '">'
        + t.letter + '</button>';
    }).join('') + (cur ? '' : '<span class="ro-chip rg-anim-letter-chip sel" title="its own ticks">custom</span>') + '</div>';
}

/** Move a placed widget's animated tiles to vanilla's pattern `presetIdx`. One undo step. */
function placedSetTiming(groupUid, presetIdx) {
  var g = editGroupFind(groupUid);
  if (!g) return;
  if (editLocked()) { editNote('this map is locked — unlock it to change what is placed on it'); return; }
  var p = _mtPalette;
  var move = function (word) {
    var e = word == null ? null : editWordAnim(p, word);
    var t = e && editAnimComplete(e) ? editAnimPresets(e)[presetIdx] : null;
    if (!t) return word;
    var slot = editAdoptAnimated(p, e.frames[0], { frames: e.frames, delays: t.delays, init: e.init || 0, vanilla: e.vanilla });
    return slot < 0 ? word : ((word & 0xfc00) | editSlotChr(slot)) & 0xffff;
  };
  editBegin();
  g.cells = g.cells.map(function (c) { return Object.assign({}, c, { layer1: move(c.layer1), layer2: move(c.layer2) }); });
  editEnd();
  editNote(g.name + ' now runs pattern ' + ANIM_LETTERS[presetIdx]);
  requestComposedPreview();
}
