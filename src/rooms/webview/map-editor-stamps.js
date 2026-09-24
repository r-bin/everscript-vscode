// Ownership: the stamp dictionary — composing and deduplicating the draft's
// own metatile combinations, and adopting graphics into Block 1 so a word
// can name one it did not start with.
//
// Split out of map-editor.js, which was pushing 400 lines once Phase 4's
// trigger-selection undo support landed (docs/map-editor-redesign-plan.md):
// this is a coherent slice — "what a stamp is made of and how one gets
// added" — with no undo-stack logic of its own. Everything here still reads
// and writes `_edit` (via `editDraft()`), the same way map-editor-special.js
// and map-editor-families.js already do without owning `_edit` themselves.

/** How many stamps exist for this room, the room's own plus composed ones. */
function editStampCount(palette) {
  return (palette ? palette.count : 0) + (_edit ? _edit.added.length : 0);
}

/**
 * Add a composed stamp, or return the index of an identical one.
 *
 * Reuse first, because a dictionary entry is not free: an editor that
 * appends on every click turns a 500-entry dictionary into thousands. The
 * room's own spare slots are offered separately by the UI; this only
 * deduplicates within the draft.
 */
function editAddStamp(palette, draft) {
  if (!_edit) return -1;
  var base = palette ? palette.count : 0;
  for (var i = 0; i < _edit.added.length; i++) {
    var a = _edit.added[i];
    if (a.layer1 === draft.layer1 && a.layer2 === draft.layer2 && a.collision === draft.collision) {
      return base + i;
    }
  }
  // An exact match already in the room costs nothing at all.
  if (palette) {
    for (var j = 0; j < palette.count; j++) {
      var e = palette.entries[j];
      if (e[1] === draft.layer1 && e[2] === draft.layer2 && e[3] === draft.collision) return j;
    }
  }
  _edit.added.push({ layer1: draft.layer1, layer2: draft.layer2, collision: draft.collision });
  return base + _edit.added.length - 1;
}

/** The three words of a stamp, whether it is the room's or the draft's. */
function editStampWords(palette, index) {
  var base = palette ? palette.count : 0;
  if (index >= base) {
    var a = _edit && _edit.added[index - base];
    return a ? { layer1: a.layer1, layer2: a.layer2, collision: a.collision, added: true } : null;
  }
  var e = palette && palette.entries[index];
  return e ? { layer1: e[1], layer2: e[2], collision: e[3], added: false } : null;
}

/**
 * The `chr` a tilemap word needs to name Block 1 slot `slot`.
 *
 * `renderVramLayer` resolves chr to a slot with
 * `floor(chr/0x20)*8 + floor((chr%0x20)/2)`; this is that inverted.
 */
function editSlotChr(slot) {
  return (slot >> 3) * 0x20 + (slot & 7) * 2;
}

/**
 * Make sure a graphic is in reach, and say which slot it landed in.
 *
 * A graphic the room never loaded cannot be named by any word, so picking
 * one out of a family's art has to add it to Block 1 first. Already-loaded
 * graphics cost nothing and keep their slot.
 */
function editAdoptGraphic(palette, graphicId) {
  if (!_edit || !palette || !palette.tiles) return -1;
  var slots = palette.tiles.slots;
  for (var i = 0; i < palette.tiles.count; i++) {
    if (slots[i][2] === graphicId) return i;
  }
  var already = _edit.addedGraphics.indexOf(graphicId);
  if (already >= 0) return palette.tiles.count + already;
  _edit.addedGraphics.push(graphicId);
  return palette.tiles.count + _edit.addedGraphics.length - 1;
}

/**
 * Turn a picked tile into a brush.
 *
 * This is the inverted flow's smallest step: click a grass tile, get
 * something you can immediately stamp. The metatile is created here rather
 * than composed by hand, and **the other two words start empty** — a bare
 * graphic says nothing about what is drawn over it or what is solid, so
 * inventing either would be a guess. They are set later, by painting in
 * deco phase or by editing the collision.
 *
 * Which word the tile becomes follows the phase, so the brush works with
 * `editResolve` rather than against it: laying out a room puts the tile on
 * the ground, decorating puts it over whatever ground is already there.
 */
function editBrushFromTile(palette, word, phase, prefer) {
  if (!_edit || word == null) return -1;
  var blank = editBlankCanopy(palette);
  // The phase is the user's intent, but the art has an opinion too: a
  // graphic with transparent pixels is meant to have something show
  // through it. 4822 of 5628 vanilla graphics are drawn on one layer at
  // least 90% of the time, so where that is known it decides, and the
  // phase only breaks the tie.
  var canopy = prefer ? prefer === 'canopy' : phase === 'deco';
  var stamp = canopy
    ? { layer1: word, layer2: blank, collision: EMPTY_COLLISION }
    : { layer1: blank, layer2: word, collision: EMPTY_COLLISION };
  var index = editAddStamp(palette, stamp);
  _edit.brush = index;
  return index;
}

/**
 * The collision a freshly made stamp starts with.
 *
 * Zero is "plane 0, geometry open" — walkable, no gates, no drift. It is
 * the honest empty: the format's do-nothing value rather than a guess at
 * what this tile ought to block.
 */
var EMPTY_COLLISION = 0x0000;

/**
 * The stamps this draft needs that the room does not already define.
 *
 * The "metatiles calculated to be needed by the creation" — every composed
 * stamp, plus what it costs. Placing the same construct twice adds nothing,
 * because `editAddStamp` deduplicates first.
 */
function editNeededStamps(palette) {
  if (!_edit) return { added: [], bytes: 0 };
  var base = palette ? palette.count : 0;
  return {
    added: _edit.added.map(function (a, i) {
      return { index: base + i, layer1: a.layer1, layer2: a.layer2, collision: a.collision };
    }),
    bytes: _edit.added.length * 8,
  };
}
