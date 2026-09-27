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
//   - Diagonal stairs are drift nibbles 1 and 2 (§6's two "shear"
//     handlers: walking east also climbs or descends) with bit 13 set —
//     vanilla puts exactly these under its stair art, and nowhere else
//     (maps/vanilla-stairs.ts). Diagonal R/L write them like a drift.
//     Vertical stairs are bit 13 with nibble 0 — no drift, the level kept —
//     the word vanilla puts under its step art (maps/vanilla-stairs.ts).
//     (§8 of that doc is an earlier version of this codebase mistaking
//     plane-transparency for a stairs test; that is still wrong.)
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
    // Only on a drafted map (specialTabHtml) — see map-editor-start.js.
    id: 'start', label: 'Start', draftOnly: true, note: 'Boy’s map entrance position.',
    items: [{ id: 'start', label: 'Boy', glyph: '☺' }],
  },
  {
    id: 'stairs', label: 'Stairs & Drift', note: 'Always-walkable stairs and conveyor drift tiles.',
    items: [
      { id: 'stairs-vert', label: 'Vertical', glyph: '⭥', drift: 0x0 },
      { id: 'stairs-diag-l', label: 'Diagonal L', glyph: '◣', drift: 0x2 },
      { id: 'stairs-diag-r', label: 'Diagonal R', glyph: '◢', drift: 0x1 },
      { id: 'drift-n', label: 'Drift N', glyph: '↑', drift: 0x8 },
      { id: 'drift-e', label: 'Drift E', glyph: '→', drift: 0xa },
      { id: 'drift-s', label: 'Drift S', glyph: '↓', drift: 0xf },
      { id: 'drift-w', label: 'Drift W', glyph: '←', drift: 0xd },
    ],
  },
  {
    id: 'gate', label: 'Gate', note: 'Entity passability filters (Boy, Dog, NPCs).',
    items: [
      { id: 'gate-boy', label: 'Boy', glyph: 'B', gate: 0x7 },
      { id: 'gate-dog', label: 'Dog', glyph: 'D', gate: 0x5 },
      { id: 'gate-party', label: 'Rest of party', glyph: 'P', gate: 0x3 },
    ],
  },
  {
    id: 'interact', label: 'Interact', note: 'B-button interaction (Bit 15) vs weapon attack.',
    items: [
      { id: 'interact-force-1', label: 'Force 1', glyph: 'F1', interact: 1 },
      { id: 'interact-force-0', label: 'Force 0', glyph: 'F0', interact: 0 },
    ],
  },
  {
    id: 'entrance', label: 'Entrance', note: 'Visual entrance markers (non-exported).',
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
// (gate) and §6 (drift, and stairs). Never touched for entrance: those
// items carry no `gate`/`drift` field, so the functions below leave the
// word exactly as editResolve already left it.
// ---------------------------------------------------------------------------

var SPECIAL_GATE_MASK = 0x0f00;   // entity gate, bits 11..8
var SPECIAL_DRIFT_MASK = 0x200f;  // AW (bit 13) + the low nibble it repurposes
var SPECIAL_INTERACT_MASK = 0x8000; // Bit 15 (Interact)

function editSpecialGateWord(word, nibble) {
  return (word & ~SPECIAL_GATE_MASK) | ((nibble & 0xf) << 8);
}

function editSpecialDriftWord(word, nibble) {
  return (word & ~SPECIAL_DRIFT_MASK) | 0x2000 | (nibble & 0xf);
}

function editSpecialInteractWord(word, bit) {
  return bit ? (word | SPECIAL_INTERACT_MASK) : (word & ~SPECIAL_INTERACT_MASK);
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
  cleared &= ~SPECIAL_INTERACT_MASK;
  return cleared;
}

/**
 * The stamp index a special pick actually writes, layered on top of
 * `baseIndex` — the tile-paint result when a brush is also armed, or just
 * the cell's existing stamp when only a special is being painted.
 *
 * `erasing` clears whatever gate/drift/interact bits are present regardless of which
 * catalog item put them there: there is exactly one gate field, one
 * AW+direction field, and one interact bit per collision word, so "clear the special here" is
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
  if (!def || (def.gate == null && def.drift == null && def.interact == null)) return baseIndex;
  var next = def.interact != null
    ? editSpecialInteractWord(words.collision, def.interact)
    : (def.gate != null
      ? editSpecialGateWord(words.collision, def.gate)
      : editSpecialDriftWord(words.collision, def.drift));
  if (next === words.collision) return baseIndex;
  return editAddStamp(palette, { layer1: words.layer1, layer2: words.layer2, collision: next });
}

function editEscH(s) {
  if (typeof escH === 'function') return escH(s);
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a special tile's white dashed outline and list of white symbols inside.
 * 1 entry: centered.
 * 2 entries: grid of 4 (top-left, bottom-right).
 * 3-4 entries: 4 quadrants.
 */
function editRenderSpecialBoxSvg(symbols, pos, extraClass, isInteract) {
  if (!symbols || !symbols.length) return '';
  var cls = extraClass ? ' ' + extraClass : '';
  var html = '<g class="' + (cls ? cls.trim() : 'rg-special-box') + '">';
  html += '<rect class="rg-special-cell-box" x="' + (pos.x + 0.05) + '" y="' + (pos.y + 0.05)
    + '" width="' + (EDIT_UNITS - 0.1) + '" height="' + (EDIT_UNITS - 0.1)
    + '" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="0.1" stroke-dasharray="0.35 0.2" pointer-events="none"/>';

  var lblCls = 'rg-special-glyph-text' + (isInteract ? ' rg-interact-lbl' : '') + cls;
  function makeTxt(txt, cx, cy, sz) {
    return '<text class="' + lblCls + '" x="' + cx + '" y="' + (cy + sz * 0.35)
      + '" text-anchor="middle" font-size="' + sz + '" font-weight="bold" fill="#ffffff" stroke="rgba(0,0,0,0.85)" stroke-width="0.08" paint-order="stroke" style="user-select:none;font-family:monospace" pointer-events="none">'
      + editEscH(txt) + '</text>';
  }

  if (symbols.length === 1) {
    html += makeTxt(symbols[0], pos.x + EDIT_UNITS / 2, pos.y + EDIT_UNITS / 2, EDIT_UNITS * 0.52);
  } else if (symbols.length === 2) {
    var fs2 = EDIT_UNITS * 0.36;
    html += makeTxt(symbols[0], pos.x + EDIT_UNITS * 0.3, pos.y + EDIT_UNITS * 0.3, fs2);
    html += makeTxt(symbols[1], pos.x + EDIT_UNITS * 0.7, pos.y + EDIT_UNITS * 0.7, fs2);
  } else {
    var fs4 = EDIT_UNITS * 0.30;
    var coords = [
      { x: pos.x + EDIT_UNITS * 0.28, y: pos.y + EDIT_UNITS * 0.28 },
      { x: pos.x + EDIT_UNITS * 0.72, y: pos.y + EDIT_UNITS * 0.28 },
      { x: pos.x + EDIT_UNITS * 0.28, y: pos.y + EDIT_UNITS * 0.72 },
      { x: pos.x + EDIT_UNITS * 0.72, y: pos.y + EDIT_UNITS * 0.72 },
    ];
    for (var i = 0; i < Math.min(symbols.length, 4); i++) {
      html += makeTxt(symbols[i], coords[i].x, coords[i].y, fs4);
    }
  }
  html += '</g>';
  return html;
}

/** Special glyph overlay on a cell: white dashed outline + white symbol(s). */
function editSpecialGlyphSvg(specialId, x, y) {
  var cellX = Math.round(x / EDIT_UNITS);
  var cellY = Math.round(y / EDIT_UNITS);
  var p = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
  if (typeof interactOverlayOn === 'function' && interactOverlayOn() && p) {
    var ist = editCellInteractState(p, cellX, cellY);
    if (ist !== '0') return ''; // Rendered by interactOverlaySvg with unified symbols
  }
  var syms = [];
  if (specialId === 'interact-force-1') syms.push('F1');
  else if (specialId === 'interact-force-0') syms.push('F0');
  else {
    var def = editSpecialById(specialId);
    if (def && def.glyph) syms.push(def.glyph);
  }
  var group = editSpecialGroupOf(specialId);
  return editRenderSpecialBoxSvg(syms, { x: x, y: y }, 'rg-special-glyph rg-special-glyph-' + group, false);
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
    html += '<button class="rdf rg-special-chip' + (current === it.id ? ' on rg-armed' : '') + '" data-edit-special="'
      + it.id + '" title="' + escH(it.label) + '">'
      + '<span class="rg-special-glyph-ic" aria-hidden="true">'
      + (it.id === START_SPECIAL_ID && _startSprite
        ? '<img class="rg-start-ic" src="' + _startSprite.uri + '" alt="">' : escH(it.glyph))
      + '</span>'
      + '<span class="rg-special-label">' + escH(it.label) + '</span></button>';
  });
  return html + '</div></div>';
}

/** Special tab body: the groups of pickable glyphs this room can use. */
function specialTabHtml() {
  var d = editDraft();
  // With the eraser out, what it takes off is shown the same armed way.
  var erasing = d && d.tool === 'erase'
    ? '<div class="rg-erase-target rg-armed">Eraser: takes every special off a cell — stairs, drift and '
      + 'gate bits and the glyph</div>' : '';
  return erasing + EDIT_SPECIAL_GROUPS.filter(function (g) { return !g.draftOnly || (d && d.blank); })
    .map(specialGroupHtml).join('');
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
    + '<button class="rdf on" data-hide="hide-special" title="Toggle special glyphs (stairs, gate, entrance)">Special</button>'
    + '<button class="rdf rg-filter-caret" data-edit-special-menu="1" title="Choose which special glyphs to show" '
    + 'aria-label="Special filter groups">▾</button>'
    + '<div class="rg-filter-popup" id="rg-special-dropdown" hidden>'
    + '<button class="rdf on" data-hide="hide-special-stairs">Stairs &amp; Drift</button>'
    + '<button class="rdf on" data-hide="hide-special-gate">Gate</button>'
    + '<button class="rdf on" data-hide="hide-special-entrance">Entrance</button>'
    + '</div></span>';
}

// ---------------------------------------------------------------------------
// Bit 15 (Interact) overlay & state reporting.
// ---------------------------------------------------------------------------

var _interactOverlayOn = false;

function interactOverlayOn() {
  return _interactOverlayOn;
}

function editInteractToggle() {
  _interactOverlayOn = !_interactOverlayOn;
  var btns = document.querySelectorAll('.rdf-interact');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', _interactOverlayOn);
  if (typeof editNote === 'function') {
    editNote(_interactOverlayOn
      ? 'Interact overlay ON — showing Bit 15 states (forced 0, forced 1, 1)'
      : 'Interact overlay OFF');
  }
  if (typeof renderEditChrome === 'function') renderEditChrome();
  var p = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
  if (typeof renderEditLayer === 'function' && p) renderEditLayer(p, typeof _editComposed !== 'undefined' ? _editComposed : null, typeof _editOrigin !== 'undefined' ? _editOrigin : { x: 0, y: 0 });
}

/**
 * State of Bit 15 for cell (x, y):
 * - 'forced 1': explicitly set to 1 via Special tab
 * - 'forced 0': explicitly set to 0 via Special tab
 * - '1': Bit 15 is 1 in the stamp collision word
 * - '0': Bit 15 is 0 in the stamp collision word (default)
 */
function editHasBTriggerAt(x, y) {
  if (typeof editTriggerList !== 'function') return false;
  var bList = editTriggerList('b');
  if (!bList || !bList.length) return false;
  for (var i = 0; i < bList.length; i++) {
    var t = bList[i];
    if (x >= t.x1 && x <= t.x2 && y >= t.y1 && y <= t.y2) return true;
  }
  return false;
}

/**
 * State of Bit 15 for cell (x, y):
 * - 'forced 1': explicitly set to 1 via Special tab
 * - 'forced 0': explicitly set to 0 via Special tab
 * - '1': Bit 15 is 1 in the stamp collision word, or cell is covered by an active B trigger
 * - '0': Bit 15 is 0 (default)
 */
function editCellInteractState(palette, x, y) {
  var sp = editSpecialAt(x, y);
  if (sp === 'interact-force-1') return 'forced 1';
  if (sp === 'interact-force-0') return 'forced 0';
  if (editHasBTriggerAt(x, y)) return '1';
  var p = palette || (typeof _mtPalette !== 'undefined' ? _mtPalette : null);
  var idx = typeof editCellAt === 'function' && p ? editCellAt(p, x, y) : -1;
  if (idx >= 0 && typeof editStampWords === 'function') {
    var w = editStampWords(p, idx);
    if (w && (w.collision & 0x8000)) return '1';
  }
  return '0';
}

function interactOverlaySvg(palette, origin) {
  var p = palette || (typeof _mtPalette !== 'undefined' ? _mtPalette : null);
  if (!p || !p.widthTiles || !p.heightTiles) return '';
  var w = p.widthTiles;
  var h = p.heightTiles;
  var html = '<g id="rg-interact-overlay" pointer-events="none">';
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var st = editCellInteractState(p, x, y);
      if (st === '0') continue;
      var pos = typeof editCellPos === 'function' ? editCellPos(origin, x, y) : { x: x * EDIT_UNITS, y: y * EDIT_UNITS };
      var syms = [];
      var sp = editSpecialAt(x, y);
      if (sp && sp !== 'interact-force-1' && sp !== 'interact-force-0') {
        var sdef = editSpecialById(sp);
        if (sdef && sdef.glyph) syms.push(sdef.glyph);
      }
      var cls = '';
      if (st === 'forced 1') { syms.push('F1'); cls = 'rg-interact-cell rg-interact-f1'; }
      else if (st === 'forced 0') { syms.push('F0'); cls = 'rg-interact-cell rg-interact-f0'; }
      else if (st === '1') { syms.push('1'); cls = 'rg-interact-cell rg-interact-1'; }
      html += editRenderSpecialBoxSvg(syms, pos, cls, true);
    }
  }
  html += '</g>';
  return html;
}
