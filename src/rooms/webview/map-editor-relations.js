// Ownership: what vanilla draws beside what — the adjacency model behind the
// tile list's ordering and the LIKELY NEIGHBORS card.
//
// Split out of map-editor-chips.js in Phase 8a (docs/map-editor-redesign-plan.md):
// that file had two unrelated things in it, the family-picker UI and this
// lookup, and the UI grew. Nothing here renders anything — map-editor-tiles.js
// draws the card, map-editor-chips.js draws the families section.
//
// **The model is undirected.** `relatedTiles()` (src/rooms/rendering/
// vanilla-index.js) answers "how often are these two graphics adjacent, in any
// direction" — one score per candidate, not four. Anything drawn as N/E/S/W
// would be inventing a distinction this index does not measure; see the plan
// doc §8a for why the mock's plus-shaped grid was deliberately not built.
//
// Owns: _related, _relatedTop, _relatedKey.

/** graphic -> 0..100, how well it goes with what is already in the map. */
var _related = {};
/** The same thing ranked, for the recommended-neighbours card. */
var _relatedTop = [];
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
 * The draft's own cells plus the armed brush — not the whole room, whose
 * hundreds of graphics would average out to no signal at all. The blank
 * canopy is skipped: "what gets drawn next to nothing" is every tile.
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
  if (_brushTile) add(_brushTile.graphic);
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
  if (!seed.length) { _related = {}; _relatedTop = []; return; }
  vs.postMessage({ command: 'requestRelated', graphics: seed });
}

function applyRelatedTiles(msg) {
  if (!msg || msg.error || !msg.related) return;
  _related = {};
  _relatedTop = msg.related;
  for (var i = 0; i < msg.related.length; i++) _related[msg.related[i][0]] = msg.related[i][1];
  renderEditPanels();
}

/** How well this graphic goes with what is placed, 0..100. */
function relatedScore(graphic) {
  var s = _related[graphic];
  return s === undefined ? 0 : s;
}
