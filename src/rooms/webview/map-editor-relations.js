// Ownership: what vanilla draws beside what — the adjacency model behind the
// tile list's ordering and the LIKELY NEIGHBORS card.
//
// Split out of map-editor-chips.js in Phase 8a (docs/map-editor-redesign-plan.md):
// that file had two unrelated things in it, the family-picker UI and this
// lookup, and the UI grew. Nothing here renders anything — map-editor-tiles.js
// draws the tile list, map-editor-neighbours.js the plus-shaped card.
//
// **Two models, two seeds, never mixed.**
// - `_related` is **undirected**: `relatedTiles()` (src/rooms/rendering/
//   vanilla-index.js) scores "drawn beside, any side", seeded from what the
//   draft has *placed*. It sorts every family's tile grid.
// - `_nbAnswer` is **directional**: `neighbourTiles()` answers "what does
//   vanilla draw north / east / south / west of this one graphic, on this
//   layer", seeded from the *armed brush* alone (§8b). It feeds only the
//   plus-shape. The brush stays out of `_related`'s seed — including it is
//   what sank a clicked tile to the bottom of its own grid (§8a.1).
//
// Owns: _related, _relatedKey, _nbAnswer, _nbKey, _nbView, _nbCycle, _nbFocus.

/** graphic -> 0..100, how well it goes with what is already in the map. */
var _related = {};
/** The seed the two above were computed for, so a redraw does not refetch. */
var _relatedKey = null;

/** The graphic a tilemap word names, or undefined if this room cannot say. */
function editGraphicOfWord(word) {
  if (word == null || !_mtPalette) return undefined;
  var chr = word & 0x3ff;
  return editGraphicAtSlot(_mtPalette, Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2));
}

/**
 * What is actually in play, as a seed for "what goes with this".
 *
 * The draft's own cells — not the armed brush, and not the whole room. Not
 * the armed brush: this seed feeds a sort, and a graphic that is its own
 * seed scores 0 (`relatedTiles` deletes a seed from its own results — it
 * cannot recommend itself), so a family's tile grid re-sorting on every
 * single click, sinking whatever you just clicked to the bottom, is exactly
 * what including it produced. Basing it on placed cells instead means the
 * order only moves when something real changes the map, not when you are
 * merely browsing candidates. Not the whole room: hundreds of graphics
 * would average out to no signal at all. The blank canopy is skipped: "what
 * gets drawn next to nothing" is every tile.
 */
function editPlacedGraphics() {
  var d = editDraft();
  if (!d || !_mtPalette) return [];
  var blank = editBlankCanopy(_mtPalette);
  var seen = {};
  var out = [];
  var add = function (g) {
    if (g === undefined || g === null || seen[g]) return;
    seen[g] = 1; out.push(g);
  };
  Object.keys(d.cells).forEach(function (k) {
    var w = editStampWords(_mtPalette, d.cells[k]);
    if (!w) return;
    if (w.layer1 !== blank) add(editGraphicOfWord(w.layer1));
    if (w.layer2 !== blank) add(editGraphicOfWord(w.layer2));
  });
  // Enough to characterise what is being built; past this it is noise.
  return out.slice(0, 24);
}

/** Refetch the relationship lookup when what is in play has changed. */
function ensureRelated() {
  if (typeof vs === 'undefined' || !vs) return;
  var seed = editPlacedGraphics();
  var key = seed.join(',');
  if (key === _relatedKey) return;
  _relatedKey = key;
  if (!seed.length) { _related = {}; return; }
  vs.postMessage({ command: 'requestRelated', graphics: seed });
}

function applyRelatedTiles(msg) {
  if (!msg || msg.error || !msg.related) return;
  _related = {};
  for (var i = 0; i < msg.related.length; i++) _related[msg.related[i][0]] = msg.related[i][1];
  renderEditPanels();
}

/** How well this graphic goes with what is placed, 0..100. */
function relatedScore(graphic) {
  var s = _related[graphic];
  return s === undefined ? 0 : s;
}

// ── directional: the plus-shape's model (§8b) ───────────────────────────────

/**
 * The host's per-side answer for the armed brush, or null while none is in.
 *
 * `{graphic, canopy: {n, e, s, w}, terrain: {n, e, s, w}}`, each side a list
 * of `[graphic, score0to100, uses, families, canopyUses, terrainUses]`, best
 * first. A side vanilla never draws anything on is an empty list, and stays
 * one — it is never filled from `_related`.
 */
var _nbAnswer = null;
/** The graphic `_nbAnswer` was asked for, so a redraw does not refetch. */
var _nbKey = null;
/** graphic|layer|H|V the cycle positions below were chosen under. */
var _nbView = '';
/** Which candidate each *displayed* side shows, as an index into its list. */
var _nbCycle = { n: 0, e: 0, s: 0, w: 0 };
/** The displayed side last clicked; the one "use" arms. */
var _nbFocus = null;

/**
 * The armed brush as the plus-shape's centre: `{graphic, family, layer}`.
 *
 * Read off the brush's own words, not only `_brushTile`: the eyedropper and
 * the stamp list arm a brush without going through a family sheet, and a
 * centre that disagreed with what the next stroke paints would be a lie.
 * `layer` is the half of the stamp the art is in — what the brush *does*,
 * whatever `_layerForce` said when it was armed.
 */
function nbCentre() {
  var d = editDraft();
  if (!d || !_brushTile || d.brush < 0 || !_mtPalette) return null;
  var w = editStampWords(_mtPalette, d.brush);
  if (!w) return null;
  var layer = w.layer1 !== editBlankCanopy(_mtPalette) ? 'canopy' : 'terrain';
  var g = editGraphicOfWord(layer === 'canopy' ? w.layer1 : w.layer2);
  if (g !== _brushTile.graphic) return null;
  return { graphic: g, family: _brushTile.family, layer: layer };
}

/** Ask for the armed brush's neighbours, once per graphic. */
function ensureNeighbours() {
  var c = nbCentre();
  var view = c ? [c.graphic, c.layer, _brushFlip.h ? 'H' : '', _brushFlip.v ? 'V' : ''].join('|') : '';
  // A different centre, layer or mirror is a different plus-shape, so the
  // cycle positions and the focus from the last one mean nothing here.
  if (view !== _nbView) { _nbView = view; _nbCycle = { n: 0, e: 0, s: 0, w: 0 }; _nbFocus = null; }
  var g = c ? c.graphic : null;
  if (g === _nbKey) return;
  _nbKey = g;
  _nbAnswer = null;
  if (g === null || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestNeighbours', graphic: g });
}

function applyNeighbourTiles(msg) {
  // A reply for a brush that has since changed is stale — dropping it is
  // what keeps a slow answer from painting the wrong tile's neighbours.
  if (!msg || msg.graphic !== _nbKey) return;
  _nbAnswer = msg.error ? { graphic: msg.graphic, error: msg.error } : msg;
  ['canopy', 'terrain'].forEach(function (layer) {
    var sides = _nbAnswer[layer];
    if (!sides) return;
    ['n', 'e', 's', 'w'].forEach(function (k) {
      var rows = sides[k] || [];
      for (var i = 0; i < rows.length; i++) {
        if (!_famLayerHint[rows[i][0]]) _famLayerHint[rows[i][0]] = [rows[i][4], rows[i][5]];
      }
    });
  });
  renderEditPanels();
}

/**
 * Which side of vanilla's data a displayed side shows, under the mirror.
 *
 * H mirrors the brush left-to-right, so what it has on its east edge is what
 * the unmirrored art has on its west: vanilla's `[W][A]`, mirrored whole, is
 * `[A'][W']`. So H swaps e/w and V swaps n/s, and every candidate is drawn —
 * and armed — mirrored the same way, which makes it the same true pair.
 */
function nbSourceSide(side) {
  if (_brushFlip.h && (side === 'e' || side === 'w')) return side === 'e' ? 'w' : 'e';
  if (_brushFlip.v && (side === 'n' || side === 's')) return side === 'n' ? 's' : 'n';
  return side;
}

/** The candidates for a displayed side, on the brush's layer. */
function nbCandidates(side) {
  var c = nbCentre();
  if (!c || !_nbAnswer || _nbAnswer.graphic !== c.graphic || !_nbAnswer[c.layer]) return [];
  return _nbAnswer[c.layer][nbSourceSide(side)] || [];
}

/** The candidate a displayed side is showing, or null if vanilla has none. */
function nbShown(side) {
  var list = nbCandidates(side);
  return list.length ? list[_nbCycle[side] % list.length] : null;
}

/** Step a side through its candidates (wrapping), and focus it. */
function nbCycleSide(side, delta) {
  var n = nbCandidates(side).length;
  if (!n || _nbCycle[side] === undefined) return;
  _nbCycle[side] = ((_nbCycle[side] + delta) % n + n) % n;
  _nbFocus = side;
  renderEditPanels();
}

/**
 * Which family a candidate would be drawn from, and whether it can be.
 *
 * An adopted family it is attested in first — that costs nothing. Else its
 * most-placed family, which needs a free palette slot; at 7/7 there is none
 * (map-editor-rules §1), so the candidate is **shown dimmed, not skipped**:
 * skipping would put a weaker neighbour in the slot and claim it was
 * vanilla's best. `{family, usable, why}`.
 */
function nbFamilyFor(row) {
  var list = (row && row[3]) || [];
  var fams = editFamilies();
  for (var i = 0; i < list.length; i++) {
    if (fams.indexOf(list[i]) >= 0) return { family: list[i], usable: true, why: '' };
  }
  if (!list.length) return { family: null, usable: false, why: 'vanilla never draws it in a family' };
  if (editFreeFamilySlot() >= 0) {
    return { family: list[0], usable: true, why: 'adds family ' + list[0] + ' to a free slot' };
  }
  return { family: list[0], usable: false,
    why: 'family ' + list[0] + ' is not loaded and all seven palette slots are taken' };
}
