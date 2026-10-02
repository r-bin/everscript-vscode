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
      { id: 'drift-n', label: 'Drift N', glyph: '↑', drift: 0x8 }, { id: 'drift-e', label: 'Drift E', glyph: '→', drift: 0xa },
      { id: 'drift-s', label: 'Drift S', glyph: '↓', drift: 0xf }, { id: 'drift-w', label: 'Drift W', glyph: '←', drift: 0xd },
      // The four diagonal handlers of §6 — vanilla places all of them.
      { id: 'drift-ne', label: 'Drift NE', glyph: '↗', drift: 0x9 }, { id: 'drift-se', label: 'Drift SE', glyph: '↘', drift: 0xb },
      { id: 'drift-sw', label: 'Drift SW', glyph: '↙', drift: 0xe }, { id: 'drift-nw', label: 'Drift NW', glyph: '↖', drift: 0xc },
      // §6: nibbles 3..7 share one handler — forced walkable, no drift. 4 is
      // the one vanilla uses most (413 cells), so it is what this writes.
      { id: 'walkable', label: 'Walkable', glyph: 'W', drift: 0x4 },
    ],
  },
  {
    // Bit 6 (map_collision_mechanics.md §3), the overlay's purple wash; its amber rungs are not a bit.
    id: 'plane', label: 'Level', note: 'See-through: walkable from any other level, and keeps the level you are on (Bit 6). Elevation changes are where two levels meet — paint levels with the bar on the left.',
    items: [{ id: 'plane-transparent', label: 'See-through', glyph: 'T', transparent: 1 }],
  },
  {
    id: 'gate', label: 'Gate & Deflect', note: 'Entity passability filters and slash deflection (Bit 8).',
    items: [
      { id: 'gate-boy', label: 'Boy', glyph: 'B', gate: 0x7 }, { id: 'gate-dog', label: 'Dog', glyph: 'D', gate: 0x5 },
      { id: 'gate-party', label: 'Rest of party', glyph: 'P', gate: 0x3 }, { id: 'deflect', label: 'Deflect', glyph: 'DF', deflect: 1, gate: 0x1 },
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
    // Bit 14 (map_collision_mechanics.md §7.2): the step-on table is only walked
    // while the player stands on one of these. The same shape as Interact.
    id: 'stepon', label: 'Step-on', note: 'Step-on trigger cells (Bit 14): a step-on trigger only fires on these.',
    items: [
      { id: 'stepon-force-1', label: 'Force 1', glyph: 'S1', stepon: 1 },
      { id: 'stepon-force-0', label: 'Force 0', glyph: 'S0', stepon: 0 },
    ],
  },
  {
    id: 'entrance', label: 'Entrance', note: 'Visual entrance markers (non-exported).',
    items: [
      { id: 'entrance-default', label: 'Default', glyph: '◆' },
      { id: 'entrance-n', label: 'North', glyph: '▲' }, { id: 'entrance-e', label: 'East', glyph: '▶' },
      { id: 'entrance-s', label: 'South', glyph: '▼' }, { id: 'entrance-w', label: 'West', glyph: '◀' },
    ],
  },
];

/** The catalog entry for an id, or null. */
function editSpecialById(id) {
  for (var g = 0; g < EDIT_SPECIAL_GROUPS.length; g++) {
    var items = EDIT_SPECIAL_GROUPS[g].items;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
  }
  return null;
}

/** Which of the groups an id belongs to, for filter-bar gating and exclusivity. */
function editSpecialGroupOf(id) {
  for (var g = 0; g < EDIT_SPECIAL_GROUPS.length; g++) {
    var group = EDIT_SPECIAL_GROUPS[g];
    for (var i = 0; i < group.items.length; i++) if (group.items[i].id === id) return group.id;
  }
  return null;
}

/** Merge a new special write ID with existing cell specials. Mutually exclusive within same group. */
function editMergeSpecial(was, swId) {
  if (swId === null) return null;
  if (Array.isArray(swId)) return swId.length === 1 ? swId[0] : swId.slice();
  var prev = was ? (Array.isArray(was) ? was.slice() : [was]) : [];
  var grp = editSpecialGroupOf(swId);
  var next = prev.filter(function (id) { return grp ? editSpecialGroupOf(id) !== grp : id !== swId; });
  next.push(swId);
  return next.length === 1 ? next[0] : next;
}

/** Array of all special IDs on cell (x, y). */
function editSpecialsAt(x, y) {
  if (typeof _objectActiveFrame !== 'undefined' && _objectActiveFrame >= 1) {
    var sel = (typeof editObjectFind === 'function' && typeof _objectSel !== 'undefined' && _objectSel != null) ? editObjectFind(_objectSel) : null;
    if (!sel && typeof editObjects === 'function') {
      var objs = editObjects();
      for (var i = 0; i < objs.length; i++) {
        if (x >= objs[i].x && y >= objs[i].y && x < objs[i].x + objs[i].w && y < objs[i].y + objs[i].h) { sel = objs[i]; break; }
      }
    }
    if (sel && sel.frameSpecials && sel.frameSpecials[_objectActiveFrame - 1]) {
      var fk = (x - sel.x) + ',' + (y - sel.y), fv = sel.frameSpecials[_objectActiveFrame - 1][fk];
      if (fv) return Array.isArray(fv) ? fv : [fv];
    }
  }
  var d = editDraft();
  if (!d || !d.specialCells) return [];
  var k = editKey(x, y);
  var v = Object.prototype.hasOwnProperty.call(d.specialCells, k) ? d.specialCells[k] : null;
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** What `specialCells` holds at this cell, or null (last item if multiple). */
function editSpecialAt(x, y) {
  var list = editSpecialsAt(x, y);
  return list.length ? list[list.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Collision-word bit math — docs/map-format/map_collision_mechanics.md §4, §6
// ---------------------------------------------------------------------------
var SPECIAL_GATE_MASK = 0x0f00;   // entity gate, bits 11..8
var SPECIAL_DRIFT_MASK = 0x200f;  // AW (bit 13) + the low nibble it repurposes
var SPECIAL_INTERACT_MASK = 0x8000; // Bit 15 (Interact)
var SPECIAL_STEPON_MASK = 0x4000; // Bit 14 (Step-on)
var SPECIAL_TRANSPARENT = 0x0040; // Bit 6 (plane-transparent)

function editSpecialGateWord(word, nibble) { return (word & ~SPECIAL_GATE_MASK) | ((nibble & 0xf) << 8); }
function editSpecialDriftWord(word, nibble) { return (word & ~SPECIAL_DRIFT_MASK) | 0x2000 | (nibble & 0xf); }
function editSpecialInteractWord(word, bit) { return bit ? (word | SPECIAL_INTERACT_MASK) : (word & ~SPECIAL_INTERACT_MASK); }
function editSpecialStepOnWord(word, bit) { return bit ? (word | SPECIAL_STEPON_MASK) : (word & ~SPECIAL_STEPON_MASK); }
function editSpecialClearWord(word) {
  var cleared = word & ~SPECIAL_GATE_MASK;
  if (cleared & 0x2000) cleared &= ~SPECIAL_DRIFT_MASK;
  return cleared & ~SPECIAL_INTERACT_MASK & ~SPECIAL_STEPON_MASK & ~SPECIAL_TRANSPARENT;
}

/**
 * The stamp index a special pick actually writes, layered on top of
 * `baseIndex` — the tile-paint result when a brush is also armed, or just
 * the cell's existing stamp when only a special is being painted.
 *
 * `erasing` clears whatever gate/drift/interact/step-on bits are present regardless of which
 * catalog item put them there: there is exactly one gate field, one
 * AW+direction field, one interact and one step-on bit per collision word, so "clear the special here" is
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
  if (!def || (def.gate == null && def.drift == null && def.interact == null && def.stepon == null && !def.transparent)) return baseIndex;
  var next = def.transparent ? words.collision | SPECIAL_TRANSPARENT : def.interact != null
    ? editSpecialInteractWord(words.collision, def.interact)
    : def.stepon != null ? editSpecialStepOnWord(words.collision, def.stepon)
    : (def.gate != null
      ? editSpecialGateWord(words.collision, def.gate)
      : editSpecialDriftWord(words.collision, def.drift));
  if (next === words.collision) return baseIndex;
  return editAddStamp(palette, { layer1: words.layer1, layer2: words.layer2, collision: next });
}

function editEscH(s) { // escH, where the page has one (some test harnesses load this file alone)
  return typeof escH === 'function' ? escH(s)
    : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a special tile's white dashed outline and list of white symbols inside.
 * 1 = centered, 2…4 = grid of 4, 5…9 = grid of 9 (top left to bottom right).
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
      + '" text-anchor="middle" font-size="' + sz + '" font-weight="bold" fill="#ffffff" stroke="rgba(0,0,0,0.85)" stroke-width="' + (sz * 0.18) + '" paint-order="stroke" style="user-select:none;font-family:monospace" pointer-events="none">'
      + editEscH(txt) + '</text>';
  }

  if (symbols.length === 1) {
    html += makeTxt(symbols[0], pos.x + EDIT_UNITS / 2, pos.y + EDIT_UNITS / 2, EDIT_UNITS * 0.52);
  } else if (symbols.length <= 4) {
    var fs = EDIT_UNITS * 0.32, u = EDIT_UNITS;
    var c4 = [{ x: pos.x + u * 0.3, y: pos.y + u * 0.3 }, { x: pos.x + u * 0.7, y: pos.y + u * 0.3 },
      { x: pos.x + u * 0.3, y: pos.y + u * 0.7 }, { x: pos.x + u * 0.7, y: pos.y + u * 0.7 }];
    for (var i = 0; i < symbols.length; i++) html += makeTxt(symbols[i], c4[i].x, c4[i].y, fs);
  } else {
    var fs9 = EDIT_UNITS * 0.20, xs = [0.22, 0.50, 0.78], ys = [0.22, 0.50, 0.78];
    for (var j = 0; j < Math.min(symbols.length, 9); j++) {
      html += makeTxt(symbols[j], pos.x + EDIT_UNITS * xs[j % 3], pos.y + EDIT_UNITS * ys[Math.floor(j / 3)], fs9);
    }
  }
  html += '</g>';
  return html;
}

function editCellSymbols(palette, x, y, specials) {
  var list = specials !== undefined ? (Array.isArray(specials) ? specials : (specials ? [specials] : [])) : editSpecialsAt(x, y);
  var syms = [], hasF0 = false, hasF1 = false;
  for (var i = 0; i < list.length; i++) {
    var id = list[i];
    if (id === 'interact-force-1') { syms.push('F1'); hasF1 = true; }
    else if (id === 'interact-force-0') { syms.push('F0'); hasF0 = true; }
    else {
      var def = editSpecialById(id);
      if (def && def.glyph) syms.push(def.glyph);
    }
  }
  if (!hasF0 && editHasBTriggerAt(x, y)) {
    syms.push('1');
  } else if (!hasF0 && !hasF1 && typeof interactOverlayOn === 'function' && interactOverlayOn()) {
    var p = palette || (typeof _mtPalette !== 'undefined' ? _mtPalette : null);
    var idx = typeof editCellAt === 'function' && p ? editCellAt(p, x, y) : -1;
    if (idx >= 0 && typeof editStampWords === 'function') {
      var sw = editStampWords(p, idx);
      if (sw && (sw.collision & 0x8000)) syms.push('1');
    }
  }
  // Bit 14, the same way, on its own overlay (map-editor-flag-overlays.js).
  if (list.indexOf('stepon-force-0') < 0 && list.indexOf('stepon-force-1') < 0
    && typeof stepOnOverlayOn === 'function' && stepOnOverlayOn() && editCellStepOnState(palette, x, y) === '1') syms.push('S');
  return syms;
}

/** Special glyph overlay on a cell: white dashed outline + white symbol(s). */
function editSpecialGlyphSvg(specialIdOrList, x, y) {
  var cellX = Math.round(x / EDIT_UNITS), cellY = Math.round(y / EDIT_UNITS);
  var list = specialIdOrList !== undefined ? (Array.isArray(specialIdOrList) ? specialIdOrList : (specialIdOrList ? [specialIdOrList] : [])) : editSpecialsAt(cellX, cellY);
  var syms = editCellSymbols(typeof _mtPalette !== 'undefined' ? _mtPalette : null, cellX, cellY, list);
  if (!syms.length) return '';
  var cls = 'rg-special-glyph';
  for (var i = 0; i < list.length; i++) {
    var g = editSpecialGroupOf(list[i]);
    if (g && cls.indexOf('rg-special-glyph-' + g) < 0) cls += ' rg-special-glyph-' + g;
  }
  return editRenderSpecialBoxSvg(syms, { x: x, y: y }, cls, false);
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
    + '<button class="rdf rg-filter-caret" data-edit-special-menu="1" title="Choose which special glyphs to show" aria-label="Special filter groups">▾</button>'
    + '<div class="rg-filter-popup" id="rg-special-dropdown" hidden>'
    + '<button class="rdf on" data-hide="hide-special-stairs">Stairs &amp; Drift</button>'
    + '<button class="rdf on" data-hide="hide-special-plane">Level (see-through)</button><button class="rdf on" data-hide="hide-special-gate">Gate &amp; Deflect</button>'
    + '<button class="rdf on" data-hide="hide-special-entrance">Entrance</button>'
    + (typeof interactChipHtml === 'function' ? interactChipHtml() : '')
    + (typeof stepOnChipHtml === 'function' ? stepOnChipHtml() : '')
    + '</div></span>';
}

// Bit 15 (Interact) and bit 14 (Step-on): their overlays and per-cell state are
// map-editor-flag-overlays.js.
