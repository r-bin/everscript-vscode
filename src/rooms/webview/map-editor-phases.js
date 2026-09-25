// Ownership: what a stroke actually writes, and what the eraser puts back.
//
// Split out of map-editor.js to keep it under the 400-line limit. Through
// v0.58.1 this file also owned the `room`/`deco` phase toggle — a manual
// mode that decided whether a stroke replaced a cell outright or preserved
// its terrain. §8a.2 (docs/map-editor-redesign-plan.md) removed the toggle:
// "the side panel selection should dictate if it is being drawn in the
// fg/bg" — both of what the toggle used to decide are already implied by
// real signals a brush and a cell already carry, so a third, independently
// settable flag was redundant with them and could disagree with what was
// actually about to be painted.
//
// - **Painting** reads the *brush's own* composed shape: a stamp with real
//   art in its canopy word (`layer1`) and a blank terrain word is a "front"
//   pick (map-editor-stamps.js's `editBrushFromTile`), which is exactly what
//   the old `deco` phase meant — decorate, keep the floor. A stamp with the
//   opposite shape is a "ground" pick, the old `room` phase's meaning —
//   replace the cell outright. There is no third shape a freshly composed
//   brush can have, so this reads the intent losslessly.
// - **Erasing** reads the *cell's own* current shape instead: if its canopy
//   is already blank there is nothing to erase (true under the old `room`
//   phase too, since erasing there was always a no-op). If it carries real
//   art, erase it — unconditionally now, which is a real usability fix: the
//   old `room` phase made `erase` a no-op regardless of the cell underneath,
//   so removing a decoration required remembering to flip to `deco` first.
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
 * No phase argument as of §8a.2 — see the file header. Painting derives
 * "is this a decoration?" from the *brush's own* words; erasing derives
 * "is there anything to erase?" from the *cell's own* words. It is still the
 * "first draw the room, then fill it with deco" model, just read off the
 * data that already carries it instead of a separately settable flag:
 *
 * - **paint, ground-composed brush** (blank canopy, real terrain — a "put
 *   this on the ground" pick): wins outright, all three words replaced. This
 *   is what laying out a floor or wall means, and what the old `room` phase
 *   did — now it happens whenever the brush itself says "I am a floor",
 *   including over an existing decoration (replacing it, not merging with
 *   it, since the brush leaves nothing to merge).
 * - **paint, canopy-composed brush** (real canopy, blank terrain — a "put
 *   this over what's there" pick): supplies the canopy and the collision,
 *   the cell keeps its terrain. Putting a gourd on a floor must not replace
 *   the floor — in room 0x34 the decorations are canopy words over an
 *   unchanged terrain word, which is exactly this operation. This is what
 *   the old `deco` phase did for this shape of brush.
 * - **erase**: reads the *cell*, not the brush — `brushIndex` is ignored. If
 *   the cell's canopy is already blank there is nothing to erase. Otherwise
 *   the canopy goes back to blank and the collision goes back to whatever
 *   the room does on bare ground of that terrain. This now runs
 *   unconditionally: the old `room` phase made erase a no-op regardless of
 *   the cell, which meant remembering to switch modes before removing a
 *   decoration — a usability gap fixed as a side effect of dropping the
 *   toggle, not a separate feature.
 *
 * Returns a metatile index, creating one through the usual find-or-create
 * rule if the combination does not exist yet.
 *
 * `hereIndex`, when given, is the stamp to resolve against instead of the
 * cell's own — the cuttable layer resolves against what it covers
 * (map-editor-cutlayer.js).
 */
function editResolve(palette, x, y, brushIndex, erasing, hereIndex) {
  var here = hereIndex === undefined ? editCellAt(palette, x, y) : hereIndex;
  var under = here >= 0 ? editStampWords(palette, here) : null;
  var blank = editBlankCanopy(palette);

  if (erasing) {
    if (!under) return -1;
    if (under.layer1 === blank) return here; // already bare: nothing to erase
    var restored = editFloorCollisionFor(palette, under.layer2);
    return editAddStamp(palette, {
      layer1: blank,
      layer2: under.layer2,
      collision: restored === null ? under.collision : restored,
    });
  }

  var brush = editStampWords(palette, brushIndex);
  // A brush with real art in its canopy word is a decoration; anything else
  // (including a brush this index cannot resolve, or nothing under it to
  // preserve) falls back to the ground-composed, replace-outright behavior.
  var isDeco = brush && brush.layer1 !== blank;
  if (!isDeco || !under) return brushIndex;

  return editAddStamp(palette, {
    layer1: brush.layer1,
    layer2: under.layer2,
    collision: brush.collision,
  });
}
