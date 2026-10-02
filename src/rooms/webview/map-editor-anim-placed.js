// Ownership: a placed widget's timing — the Placed list's A/B/C chips
// (map-editor-placed-list.js shows them) and moving a placed widget's tiles
// onto another timing of the same animation. The model is
// map-editor-animations.js. Split out of it.
//
// Owns: nothing.

/** The animation groups a placed group's words move with, by uid. */
function placedAnimsOf(g) {
  var out = {};
  (g.cells || []).forEach(function (c) {
    [c.layer1, c.layer2].forEach(function (word) {
      var a = word == null ? null : editWordAnim(_mtPalette, word);
      if (a) out[a.uid] = a;
    });
  });
  return out;
}

/** The timing chips for a placed widget whose tiles move: one per timing of the same animation. */
function placedTimingHtml(g) {
  if (!_mtPalette) return '';
  var mine = placedAnimsOf(g), uids = Object.keys(mine);
  if (uids.length !== 1) return '';
  var cur = mine[uids[0]], kind = animKind(cur);
  var listed = editAnimsListed(_mtPalette), letters = editAnimLetters(listed);
  var same = listed.filter(function (e) { return animKind(e.g) === kind; });
  if (same.length < 2) return '';
  return '<div class="rg-anim-timing-chips"><span class="rg-anim-timing-lbl">timing</span>'
    + same.map(function (e) {
      return '<button class="ro-chip rg-anim-letter-chip' + (e.g.uid === cur.uid ? ' sel' : '') + '" data-anim-timing="' + e.g.uid
        + '" data-anim-group="' + g.uid + '" title="Move with timing ' + letters[e.g.uid] + ' (' + e.g.delays.join(' ') + ' ticks)">'
        + letters[e.g.uid] + '</button>';
    }).join('') + '</div>';
}

/**
 * Move a placed widget's tiles to another timing of the same animation:
 * each word goes to the target group's slot on the same cycle (adopted for
 * it when it has none). One undo step.
 */
function placedSetTiming(groupUid, animUid) {
  var g = editGroupFind(groupUid), to = editAnimFind(animUid);
  if (!g || !to) return;
  if (editLocked()) { editNote('this map is locked — unlock it to change what is placed on it'); return; }
  var p = _mtPalette;
  var slotFor = function (word) {
    var from = editWordAnim(p, word);
    if (!from || from === to) return null;
    var seq = from.channels[animWordSlot(word)], key = animCycleKey(seq);
    for (var s in to.channels) if (animCycleKey(to.channels[s]) === key && editAnimOfSlot(p, Number(s)) === to) return Number(s);
    var ns = editAdoptGraphic(p, seq[0], to.uid);
    if (ns >= 0) to.channels[ns] = seq.slice(0, to.delays.length);
    return ns >= 0 ? ns : null;
  };
  var move = function (word) {
    var ns = word == null ? null : slotFor(word);
    if (ns == null) return word;
    var s = animWordSlot(word);
    return (word & ~0x3ff & 0xffff) | ((editSlotChr(ns) + ((word & 0x3ff) - editSlotChr(s))) & 0x3ff);
  };
  editBegin();
  g.cells = g.cells.map(function (c) { return Object.assign({}, c, { layer1: move(c.layer1), layer2: move(c.layer2) }); });
  editEnd();
  editNote(g.name + ' now moves with timing ' + (editAnimLetters(editAnimsListed(p))[to.uid] || ''));
  requestComposedPreview();
}
