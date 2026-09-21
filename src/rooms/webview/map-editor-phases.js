// Ownership: layer phases — what a stroke actually writes, and what the
// eraser puts back.
//
// Split out of map-editor.js to keep it under the 400-line limit. This is
// the whole of "first draw the room, then fill it with deco": the two
// phases write different words, and the eraser derives what bare floor
// looks like from the room rather than assuming it.
//
// See docs/map-format/building-a-room-from-a-picture.md §8.

// ---------------------------------------------------------------------------
// Layer phases: what a stroke actually writes.
// ---------------------------------------------------------------------------

/**
 * The room's blank canopy word — what "no decoration here" looks like.
 *
 * Derived rather than hardcoded, but it is `$A800` in every room measured:
 * 140 placements in room 0x34, 2034 in 0x76, 3800 in 0x38. Room 0x34's
 * graphic at that word has **zero** non-transparent pixels, so erasing to it
 * really does erase.
 */
function editBlankCanopy(palette) {
  if (!palette || !palette.count) return 0xa800;
  var counts = {};
  var best = 0xa800;
  var bestN = -1;
  for (var i = 0; i < palette.count; i++) {
    var e = palette.entries[i];
    if (!e[4]) continue;
    var w = e[1];
    counts[w] = (counts[w] || 0) + e[4];
    if (counts[w] > bestN) { bestN = counts[w]; best = w; }
  }
  return best;
}

/**
 * How the room normally behaves on this terrain.
 *
 * Used when erasing: taking the decoration's picture away should take its
 * collision with it, or removing a gourd would leave a hole you still
 * cannot walk through. The room's own most-placed stamp on that terrain is
 * the evidence for what the bare floor does.
 */
function editFloorCollisionFor(palette, layer2Word) {
  if (!palette) return null;
  var best = null;
  var bestN = -1;
  for (var i = 0; i < palette.count; i++) {
    var e = palette.entries[i];
    if (e[2] !== layer2Word || !e[4]) continue;
    if (e[4] > bestN) { bestN = e[4]; best = e[3]; }
  }
  return best;
}

/**
 * The stamp a stroke should write at this cell.
 *
 * This is where the phase split lives, and it is the whole of the "first
 * draw the room, then fill it with deco" model:
 *
 * - **room**: the brush wins outright. All three words are replaced, which
 *   is what laying out a floor or a wall means.
 * - **deco**: the brush supplies the canopy and the collision, the cell
 *   keeps its terrain. Putting a gourd on a floor must not replace the
 *   floor — in room 0x34 the decorations are canopy words over an unchanged
 *   terrain word, which is exactly this operation.
 * - **erase** (deco): the canopy goes back to blank and the collision goes
 *   back to whatever the room does on bare ground of that terrain.
 *
 * Returns a metatile index, creating one through the usual find-or-create
 * rule if the combination does not exist yet.
 */
function editResolve(palette, x, y, brushIndex, phase, erasing) {
  var here = editCellAt(palette, x, y);
  var under = here >= 0 ? editStampWords(palette, here) : null;
  if (phase !== 'deco' || !under) {
    if (erasing) return -1;
    return brushIndex;
  }

  if (erasing) {
    var blank = editBlankCanopy(palette);
    if (under.layer1 === blank) return here; // already bare: nothing to erase
    var restored = editFloorCollisionFor(palette, under.layer2);
    return editAddStamp(palette, {
      layer1: blank,
      layer2: under.layer2,
      collision: restored === null ? under.collision : restored,
    });
  }

  var brush = editStampWords(palette, brushIndex);
  if (!brush) return -1;
  return editAddStamp(palette, {
    layer1: brush.layer1,
    layer2: under.layer2,
    collision: brush.collision,
  });
}
