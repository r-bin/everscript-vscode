// Ownership: the canvas column's two docked bars — the view-filter bar under
// the canvas card, and the status bar under that.
//
// Split out of detail-renderer.js in Phase 7a
// (docs/map-editor-redesign-plan.md §7a). That file used to build ~25 chips
// inline as one flat list; this one owns the *arrangement* the design mock
// asks for instead: a segmented Background|Foreground|Collision pill, then
// `Triggers ▾`, `Objects ▾`, `Special ▾` and `more ▾`. Nothing was deleted —
// every pre-existing toggle still renders, with the same `data-hide` /
// `data-ov` / `data-layer` key it always had, just filed under whichever chip
// it has affinity with.
//
// What it does NOT own:
//   - the ROM view controls themselves (rom-overlay.js: `_currentLayer`,
//     `_currentOverlay`, and the per-button builders this file arranges),
//   - the Special chip (map-editor-special.js — it carries the stairs/gate/
//     entrance group ids, which are model, not layout),
//   - what a `data-hide` class actually hides (shared.css + the class sync in
//     detail-renderer.js), or the click handlers (interactions.js's
//     setupClickHandlers binds `.rdf[data-hide]` wherever it sits, and
//     rom-overlay.js's setupLayerButtons binds `.rdf-layer`/`.rdf-ov`/
//     `.rdf-vis` the same way — both query the whole panel, so moving a
//     control into a dropdown cannot orphan it).
//
// Owns no state. Every chip reads the one owner of whatever it shows.

/** A plain view toggle: on means "this content is visible". */
function viewHideBtnHtml(key, label, title) {
  return '<button class="rdf on" data-hide="' + key + '" title="' + escH(title) + '">'
    + escH(label) + '</button>';
}

/** The opposite default: off until clicked, and on it adds `key` to the panel. */
function viewShowBtnHtml(key, label, title) {
  return '<button class="rdf" data-show="' + key + '" title="' + escH(title) + '">' + escH(label) + '</button>';
}

/**
 * A chip plus a caret that opens a popup of sub-toggles.
 *
 * The same three classes every filter-bar dropdown in this editor shares
 * (`.rg-filter-group`/`.rg-filter-caret`/`.rg-filter-popup`, generalized in
 * Phase 6) and the same one close-on-outside-click mechanism: a new dropdown
 * is one entry in map-editor-input.js's `EDIT_FILTER_MENUS` plus one key in
 * its `EDIT_CLICK_KEYS`, never a second mechanism.
 *
 * `flat` is the chip itself — the single toggle the whole group reads as —
 * and may be empty for a group that is only a menu (`more`).
 */
function filterGroupHtml(p) {
  if (!p.subs.length) return p.flat || '';
  return '<span class="rg-filter-group">' + (p.flat || '')
    + '<button class="rdf rg-filter-caret" data-' + p.menuAttr + '="1" title="' + escH(p.caretTitle)
    + '" aria-label="' + escH(p.caretTitle) + '">' + (p.flat ? '▾' : escH(p.label) + ' ▾') + '</button>'
    + '<div class="rg-filter-popup' + (p.wide ? ' rg-filter-popup-grid' : '') + '" id="' + p.id
    + '" hidden>' + p.subs.join('') + '</div></span>';
}

/**
 * Background | Foreground | Collision, as one bordered segmented group (the shared
 * builders in src/core/map-editor/view/view-chips.js, also used by the Secret of
 * Mana Maps panel).
 *
 * Background and Foreground are two views of rom-overlay.js's single
 * `_currentLayer` (see `romLayerVis` there for why that is one owner and not
 * two booleans); Collision is the `c` feature flag, genuinely independent.
 * `composite` — the explicit "both layers" pick — stays reachable in the
 * overflow menu below, since the segments already express it as "both on".
 */
function visSegmentsHtml(ctx) {
  if (!ctx.romId) return '';
  return mapViewSegHtml([
    romVisSegmentHtml('bg', 'BG',
      'Background: draw the terrain layer (the “L2 terrain” render). Both segments on is the composite.'),
    romVisSegmentHtml('fg', 'FG',
      'Foreground: draw the canopy layer (the “L1 canopy” render). Both segments on is the composite.'),
    collisionChipHtml(),
    typeof cutLayerButtonHtml === 'function' ? cutLayerButtonHtml() : '',
  ]);
}

/** Toggle button for Bit 15 (Interact) overlay — in the Special menu (map-editor-special.js). */
function interactChipHtml() {
  var on = typeof interactOverlayOn === 'function' && interactOverlayOn();
  return '<button class="rdf rdf-interact' + (on ? ' on' : '') + '" data-edit-act="interact-overlay"'
    + ' title="' + escH('Toggle Bit 15 (Interact) overlay: shows forced 0, forced 1, 1, or 0. Off by default.') + '">Interact</button>';
}

/** Toggle button for Bit 14 (Step-on) overlay — beside Interact, in the Special menu. */
function stepOnChipHtml() {
  var on = typeof stepOnOverlayOn === 'function' && stepOnOverlayOn();
  return '<button class="rdf rdf-stepon' + (on ? ' on' : '') + '" data-edit-act="stepon-overlay"'
    + ' title="' + escH('Toggle Bit 14 (Step-on) overlay: S marks the cells a step-on trigger fires on; S1/S0 are forced. Off by default.') + '">Step-on</button>';
}

/**
 * Collision, and behind its caret how it is drawn: the smart outline (the
 * per-plane contours, default) or tile by tile — every solid pixel in its
 * level's colour. rom-overlay.js owns the mode (`_collisionMode`).
 */
function collisionChipHtml() {
  var mode = typeof _collisionMode === 'string' ? _collisionMode : 'outline';
  var opt = function (key, label, tip) {
    return '<button class="rdf' + (mode === key ? ' on' : '') + '" data-collision-mode="' + key + '" title="'
      + escH(tip) + '">' + escH(label) + '</button>';
  };
  return mapViewMenuChipHtml(romOverlayButtonHtml('c', 'Collision'), {
    attr: 'edit-collision-menu', id: 'rg-collision-dropdown', title: 'How collision is drawn',
    options: [
      opt('outline', 'Outline', 'The smart outline: each level’s walls as a contour, the wall tint inside'),
      opt('tiles', 'Tile by tile', 'Every pixel a tile makes solid, filled in its level’s colour'),
    ],
  });
}

/**
 * Triggers: only the two kinds of trigger (§8e — "only B and step-on are
 * triggers"). The tables, the ROM trigger render and the grids used to be
 * filed here by affinity; they are in More now.
 */
function triggerFilterGroupHtml(ctx) {
  // A custom map has no source triggers, but the ones drawn on it still toggle.
  if (!ctx.hasTriggers && !ctx.romId) return '';
  return filterGroupHtml({
    flat: viewHideBtnHtml('hide-trigger', 'Triggers', 'Step-on and B-trigger boxes'),
    label: 'Triggers', menuAttr: 'edit-trigger-menu', id: 'rg-trigger-dropdown',
    caretTitle: 'Which kind of trigger to show',
    subs: [
      viewHideBtnHtml('hide-step', 'Step trigger', 'Step-on trigger boxes'),
      viewHideBtnHtml('hide-btrig', 'B trigger', 'B-trigger boxes'),
      // Labels in the box's first cell, on the special glyphs' 3×3 grid.
      viewHideBtnHtml('hide-trig-type', 'Type', 'B or S in the corner of each box'),
      viewShowBtnHtml('show-trig-id', 'Script ID', 'The script each box runs, in hex, beside its type'),
    ],
  });
}

/**
 * Objects: the room's object tiles. On a ROM room that is the `o` feature
 * render; on a source room, the objects its script defines. Its menu holds
 * only what an object itself shows — its number and its sub-frames (v0.91.0);
 * NPCs, hitboxes, grass and the rest stay in More.
 */
function objectFilterGroupHtml(ctx) {
  var flat = ctx.romId ? romOverlayButtonHtml('o', 'Objects')
    : ctx.hasObjects ? viewHideBtnHtml('hide-obj', 'Objects', 'Objects defined in this room’s source') : '';
  if (!flat) return '';
  return filterGroupHtml({
    flat: flat, label: 'Objects', menuAttr: 'edit-object-menu', id: 'rg-object-dropdown',
    caretTitle: 'What each object shows',
    subs: [
      viewShowBtnHtml('show-obj-id', 'ID', 'Each object’s number — the one a script’s SET OBJ names'),
      viewShowBtnHtml('show-obj-frames', 'Sub-frames', 'Where each changed state draws, for every object'),
    ],
  });
}

function copyMapButtonHtml() {
  return '<button class="rdf rg-filter-sub" data-edit-act="copy-map" title="Duplicate this room as a new custom map">Copy map</button>';
}

/**
 * Everything else, in one drawer: the collision-word feature renders, what
 * the room places besides objects, the trigger tables and grids, the
 * sections below the map, and the two actions (`animate`, `export png`).
 */
function moreFilterGroupHtml(ctx) {
  var subs = [];
  if (ctx.hasMap) subs.push(viewHideBtnHtml('hide-map', 'Map area', 'The map area itself'));
  if (ctx.romId) {
    subs.push(romLayerButtonHtml('composite', 'Composite'));
    subs.push(romAllOverlaysButtonHtml());
    ['d', 'e', 'p', 'n', 'l'].forEach(function (f) { subs.push(romOverlayButtonHtml(f)); });
    subs.push(viewHideBtnHtml('hide-fg', 'Canopy over sprites',
      'Draw the foreground over the characters it covers in game, and dash the collision it hides'));
  }
  // Placed things that are not object tiles (§8e: "the items should be in misc").
  if (ctx.hasSpawns) subs.push(viewHideBtnHtml('hide-spawn', 'NPCs', 'NPCs the enter script can place'));
  if (ctx.hasHitbox) subs.push(viewHideBtnHtml('hide-hitbox', 'Hitboxes', 'Collision boxes (2r wide, r tall)'));
  if (ctx.romId) subs.push(romOverlayButtonHtml('g', 'Grass'));
  if (ctx.romId && ctx.hasObjects) subs.push(viewHideBtnHtml('hide-obj', 'Source objects', 'Objects defined in this room’s source'));
  if (ctx.hasEntrances) subs.push(viewHideBtnHtml('hide-ent', 'Entrances', 'Entrance markers'));
  if (ctx.hasEnemies) subs.push(viewHideBtnHtml('hide-enem', 'Enemies', 'Enemies'));
  if (ctx.hasPoi) subs.push(viewHideBtnHtml('hide-poi', 'POI', 'Lua points of interest'));
  // What used to sit under Triggers without being a trigger.
  if (ctx.hasScripts) subs.push(viewHideBtnHtml('hide-scripts', 'Script tables', 'Decoded script tables below the map'));
  if (ctx.romId) subs.push(romOverlayButtonHtml('t', 'ROM triggers'));
  if (ctx.hasMap) subs.push(viewHideBtnHtml('hide-grid8', '8 px grid', 'The 8 px tile grid'));
  if (ctx.hasMap) subs.push(viewHideBtnHtml('hide-grid16', '16 px grid', 'The 16 px metatile grid triggers are measured in'));
  if (ctx.hasIngr) subs.push(viewHideBtnHtml('hide-ingr', '🌿 Item icons', 'The icon of what a B-trigger hands over — ingredients, consumables, armour'));
  if (ctx.hasArrivals) subs.push(viewHideBtnHtml('hide-arrival', 'Arrivals', 'The doors that lead into this room'));
  if (ctx.hasHeader) subs.push(viewHideBtnHtml('hide-header', 'ROM header', 'The ROM header section'));
  if (ctx.romId || ctx.hasMap) subs.push(copyMapButtonHtml());
  if (ctx.romId) { subs.push(romAnimateButtonHtml()); subs.push(romExportButtonHtml()); }
  if (!subs.length) return '';
  return filterGroupHtml({
    flat: '', label: 'More', menuAttr: 'edit-more-menu', id: 'rg-more-dropdown',
    caretTitle: 'Everything else this room can show', subs: subs, wide: true,
  });
}

/**
 * The bar itself: the mock's primary slots — view filters only. The lock
 * is a verb, so it is the tool pill's (map-editor-toolbar.js); every map
 * opens in the editor, and a vanilla one opens locked (detail-renderer.js).
 */
function buildViewFilterBarHtml(ctx) {
  var parts = [
    visSegmentsHtml(ctx),
    triggerFilterGroupHtml(ctx),
    objectFilterGroupHtml(ctx),
    ctx.romId ? buildSpecialFilterChipHtml() : '',
    typeof animMarksButtonHtml === 'function' ? animMarksButtonHtml() : '',
    moreFilterGroupHtml(ctx),
  ].filter(function (h) { return !!h; });
  // The lock moved to the tool pill's right end (map-editor-toolbar.js).
  return '<div class="rd-filters rg-view-filters">' + parts.join('') + '</div>';
}

// ── the status bar ────────────────────────────────────────────────────────

/**
 * The status bar under the filter bar (the shell's shellStatusbarHtml): hovered cell, room size, the draft
 * summary (`#rg-edit-count`: map-editor-input.js's `editNote` and map-editor-ui.js's `renderEditChrome`
 * write it) and the hovered entity's own label (`#rg-tip`: interactions.js's setupHoverHighlights).
 * Built on every room render, not only in edit mode: the coordinate read-out is useful while browsing.
 */
function buildStatusBarHtml(opts) {
  return shellStatusbarHtml({ width: opts && opts.widthTiles, height: opts && opts.heightTiles });
}

/** Room size in metatiles, from whichever source knows it. */
function statusRoomSize(rh, imageDims) {
  if (rh && rh.mapWpx && rh.mapHpx) return { widthTiles: Math.round(rh.mapWpx / 16), heightTiles: Math.round(rh.mapHpx / 16) };
  if (imageDims && imageDims.w && imageDims.h) return { widthTiles: Math.round(imageDims.w / 16), heightTiles: Math.round(imageDims.h / 16) };
  return {};
}

/** Keep `#rg-status-size` agreeing with the grid actually on screen. */
function renderStatusSize() {
  var el = document.getElementById('rg-status-size');
  if (!el || !_mtPalette || !_mtPalette.widthTiles) return;
  el.textContent = _mtPalette.widthTiles + ' × ' + _mtPalette.heightTiles;
}

/** Track the pointer's cell into the status bar (the shell's shellStatusBind). */
function setupStatusBar() {
  shellStatusBind(function (e) {
    var cell = (typeof editEventCell === 'function') ? editEventCell(e) : null;
    if (!cell) return null;
    var interactInfo = '';
    if (typeof editCellInteractState === 'function') {
      var pal = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
      interactInfo = ' · interact: ' + editCellInteractState(pal, cell.x, cell.y);
      if (typeof editCellStepOnState === 'function') interactInfo += ' · step-on: ' + editCellStepOnState(pal, cell.x, cell.y);
    }
    return 'x: ' + statusPad2(cell.x) + ' y: ' + statusPad2(cell.y) + interactInfo;
  });
}
