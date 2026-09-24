// Ownership: the Special tab (Stairs & Drift / Gate / Entrance) — its
// catalog, its collision-word bit math, the tab's own markup, and the
// filter bar's "special" chip + dropdown. State (`currentSpecialId`,
// `specialCells`) lives in map-editor.js's `_edit`; this file only reads
// and writes it through `editDraft()`/`editApply()`, the same way every
// other panel file already does.
//
// Which picks are real vs. cosmetic is not a UI decision — it follows
// docs/map-format/map_collision_mechanics.md byte for byte:
//   - Gate (§4, bits 11..8) and Drift (§6, bit 13 + bits 3..0) are genuine
//     collision-word writes, wired below through the same
//     {layer1, layer2, collision} stamp model editResolve already uses.
//   - "Stairs" has no attested distinct encoding — §8 of that doc is a
//     previous version of this codebase mistaking plane-transparency for a
//     stairs test, called out explicitly as wrong. The three Stairs items
//     below carry no `gate`/`drift` field, so editSpecialAppliedIndex never
//     touches the collision word for them: they are an icon over an
//     ordinary painted tile, nothing else.
//   - Entrance is "stored in the room's data, not the tile grid" per the
//     design mock's own README, and editExport() has no field to put it in
//     (docs/map-editor-redesign-plan.md §5.1) — visual-only, not exported.

/**
 * The three groups the Special tab and the filter-bar dropdown both read
 * from. `gate`/`drift` carry the real nibble; its absence means "glyph
 * only, no collision effect" — see the file header.
 */
var EDIT_SPECIAL_GROUPS = [
  {
    id: 'stairs', label: 'Stairs & Drift',
    note: 'One per tile — picking a new one replaces the last. Vertical/Diagonal L/Diagonal R '
      + 'are icon-only: no distinct collision encoding is attested for them. The four Drift '
      + 'picks are real collision-word writes (always-walkable + a direction nibble).',
    items: [
      { id: 'stairs-vert', label: 'Vertical', glyph: '⭥' },
      { id: 'stairs-diag-l', label: 'Diagonal L', glyph: '◺' },
      { id: 'stairs-diag-r', label: 'Diagonal R', glyph: '◹' },
      { id: 'drift-n', label: 'Drift N', glyph: '↑', drift: 0x8 },
      { id: 'drift-e', label: 'Drift E', glyph: '→', drift: 0xa },
      { id: 'drift-s', label: 'Drift S', glyph: '↓', drift: 0xf },
      { id: 'drift-w', label: 'Drift W', glyph: '←', drift: 0xd },
    ],
  },
  {
    id: 'gate', label: 'Gate',
    note: 'Collision only — no visual. A real entity-gate write: "Rest of party" is nibble 3 '
      + '(blocks everything except the boy and the dog), "Dog" is nibble 5 (blocks the dog '
      + 'only), "Boy" is nibble 7 (blocks the boy and the dog together — no boy-only nibble is '
      + 'attested in any vanilla room).',
    items: [
      { id: 'gate-boy', label: 'Boy', glyph: 'B', gate: 0x7 },
      { id: 'gate-dog', label: 'Dog', glyph: 'D', gate: 0x5 },
      { id: 'gate-party', label: 'Rest of party', glyph: 'P', gate: 0x3 },
    ],
  },
  {
    id: 'entrance', label: 'Entrance',
    note: 'Stored in the room’s data, not the tile grid — these are placement helpers only. '
      + 'Visual-only here: not written into the exported draft.',
    items: [
      { id: 'entrance-default', label: 'Default', glyph: '◆' },
      { id: 'entrance-n', label: 'North', glyph: '▲' },
      { id: 'entrance-e', label: 'East', glyph: '▶' },
      { id: 'entrance-s', label: 'South', glyph: '▼' },
      { id: 'entrance-w', label: 'West', glyph: '◀' },
    ],
  },
];

/** The catalog entry for an id, or null. */
function editSpecialById(id) {
  for (var g = 0; g < EDIT_SPECIAL_GROUPS.length; g++) {
    var items = EDIT_SPECIAL_GROUPS[g].items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
  }
  return null;
}

/** Which of the three groups an id belongs to, for filter-bar gating. */
function editSpecialGroupOf(id) {
  for (var g = 0; g < EDIT_SPECIAL_GROUPS.length; g++) {
    var group = EDIT_SPECIAL_GROUPS[g];
    for (var i = 0; i < group.items.length; i++) {
      if (group.items[i].id === id) return group.id;
    }
  }
  return null;
}

/** What `specialCells` holds at this cell, or null. */
function editSpecialAt(x, y) {
  var d = editDraft();
  if (!d) return null;
  var k = editKey(x, y);
  return Object.prototype.hasOwnProperty.call(d.specialCells, k) ? d.specialCells[k] : null;
}

// ---------------------------------------------------------------------------
// Collision-word bit math — docs/map-format/map_collision_mechanics.md §4
// (gate) and §6 (drift). Never touched for stairs/entrance: those items
// carry no `gate`/`drift` field, so the functions below leave the word
// exactly as editResolve already left it.
// ---------------------------------------------------------------------------

var SPECIAL_GATE_MASK = 0x0f00;   // entity gate, bits 11..8
var SPECIAL_DRIFT_MASK = 0x200f;  // AW (bit 13) + the low nibble it repurposes

function editSpecialGateWord(word, nibble) {
  return (word & ~SPECIAL_GATE_MASK) | ((nibble & 0xf) << 8);
}

function editSpecialDriftWord(word, nibble) {
  return (word & ~SPECIAL_DRIFT_MASK) | 0x2000 | (nibble & 0xf);
}

/**
 * Undo either field, leaving the rest of the word — plane, PT, geometry —
 * untouched.
 *
 * The drift mask also covers bits 3..0, which are ordinary geometry (not a
 * direction) unless bit 13 (AW) is actually set — clearing them
 * unconditionally would erase real geometry off a tile that only ever had
 * a gate on it. Only clear them when AW says they were a direction.
 */
function editSpecialClearWord(word) {
  var cleared = word & ~SPECIAL_GATE_MASK;
  if (cleared & 0x2000) cleared &= ~SPECIAL_DRIFT_MASK;
  return cleared;
}

/**
 * The stamp index a special pick actually writes, layered on top of
 * `baseIndex` — the tile-paint result when a brush is also armed, or just
 * the cell's existing stamp when only a special is being painted.
 *
 * `erasing` clears whatever gate/drift bits are present regardless of which
 * catalog item put them there: there is exactly one gate field and one
 * AW+direction field per collision word, so "clear the special here" is
 * unambiguous without knowing which pick it was.
 */
function editSpecialAppliedIndex(palette, baseIndex, specialId, erasing) {
  if (baseIndex < 0) return baseIndex;
  var words = editStampWords(palette, baseIndex);
  if (!words) return baseIndex;
  if (erasing) {
    var cleared = editSpecialClearWord(words.collision);
    if (cleared === words.collision) return baseIndex;
    return editAddStamp(palette, { layer1: words.layer1, layer2: words.layer2, collision: cleared });
  }
  var def = editSpecialById(specialId);
  if (!def || (def.gate == null && def.drift == null)) return baseIndex;
  var next = def.gate != null
    ? editSpecialGateWord(words.collision, def.gate)
    : editSpecialDriftWord(words.collision, def.drift);
  if (next === words.collision) return baseIndex;
  return editAddStamp(palette, { layer1: words.layer1, layer2: words.layer2, collision: next });
}

/** One glyph, cropped to nothing — a `<text>` over the painted cell, drawn by renderEditLayer. */
function editSpecialGlyphSvg(specialId, x, y) {
  var def = editSpecialById(specialId);
  if (!def) return '';
  var group = editSpecialGroupOf(specialId);
  var fs = EDIT_UNITS * 0.8;
  var cx = x + EDIT_UNITS / 2;
  var cy = y + EDIT_UNITS / 2 + fs * 0.35;
  return '<text class="rg-special-glyph rg-special-glyph-' + group + '" x="' + cx + '" y="' + cy
    + '" text-anchor="middle" font-size="' + fs + '" pointer-events="none" style="user-select:none">'
    + escH(def.glyph) + '</text>';
}

// ---------------------------------------------------------------------------
// The Special tab itself.
// ---------------------------------------------------------------------------

function specialGroupHtml(group) {
  var d = editDraft();
  var current = d ? d.currentSpecialId : null;
  var html = '<div class="rg-special-group"><div class="rg-special-h">' + escH(group.label) + '</div>'
    + '<div class="rs-note">' + escH(group.note) + '</div>'
    + '<div class="rg-special-grid">';
  group.items.forEach(function (it) {
    html += '<button class="rdf rg-special-chip' + (current === it.id ? ' on' : '') + '" data-edit-special="'
      + it.id + '" title="' + escH(it.label) + '">'
      + '<span class="rg-special-glyph-ic" aria-hidden="true">' + escH(it.glyph) + '</span>'
      + '<span class="rg-special-label">' + escH(it.label) + '</span></button>';
  });
  return html + '</div></div>';
}

/** Special tab body: three groups of pickable glyphs. */
function specialTabHtml() {
  return EDIT_SPECIAL_GROUPS.map(specialGroupHtml).join('');
}

/**
 * The filter bar's Special chip: one boolean for the whole group, matching
 * every other chip in that bar (detail-renderer.js's filtersHtml), plus a
 * caret that opens a dropdown of the three sub-toggles.
 *
 * The sub-toggle buttons are plain `.rdf[data-hide]` chips — they ride the
 * exact delegated handler every other filter chip in this bar already uses
 * (interactions.js's setupClickHandlers binds fresh listeners to them at
 * render time, same as "map"/"header"/"canopy"); only the dropdown's own
 * open/close is new, and that is wired through map-editor-input.js's
 * already-bind-once panel click handler (`editSpecialMenu`), not a second
 * mechanism. `.rg-filter-group`/`.rg-filter-caret`/`.rg-filter-popup`
 * (map-editor-theme.css) are the shared chip+caret+popup chrome every
 * filter-bar dropdown uses — see map-editor-trigger-panel.js's
 * buildTriggerFilterChipHtml for the other one.
 */
function buildSpecialFilterChipHtml() {
  return '<span class="rg-filter-group">'
    + '<button class="rdf on" data-hide="hide-special" title="Toggle special glyphs (stairs, gate, entrance)">special</button>'
    + '<button class="rdf rg-filter-caret" data-edit-special-menu="1" title="Choose which special glyphs to show" '
    + 'aria-label="Special filter groups">▾</button>'
    + '<div class="rg-filter-popup" id="rg-special-dropdown" hidden>'
    + '<button class="rdf on" data-hide="hide-special-stairs">Stairs &amp; Drift</button>'
    + '<button class="rdf on" data-hide="hide-special-gate">Gate</button>'
    + '<button class="rdf on" data-hide="hide-special-entrance">Entrance</button>'
    + '</div></span>';
}
