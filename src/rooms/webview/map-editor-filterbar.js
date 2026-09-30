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
 * Background | Foreground | Collision, as one bordered segmented group.
 *
 * Background and Foreground are two views of rom-overlay.js's single
 * `_currentLayer` (see `romLayerVis` there for why that is one owner and not
 * two booleans); Collision is the `c` feature flag, genuinely independent.
 * `composite` — the explicit "both layers" pick — stays reachable in the
 * overflow menu below, since the segments already express it as "both on".
 */
function visSegmentsHtml(ctx) {
  if (!ctx.romId) return '';
  return '<span class="rg-seg">'
    + romVisSegmentHtml('bg', 'Background',
      'Draw the terrain layer (BG1 — the “L2 terrain” render). Both segments on is the composite.')
    + romVisSegmentHtml('fg', 'Foreground',
      'Draw the canopy layer (BG2 — the “L1 canopy” render). Both segments on is the composite.')
    + collisionChipHtml()
    + interactChipHtml()
    + (typeof cutLayerButtonHtml === 'function' ? cutLayerButtonHtml() : '')
    + '</span>';
}

/** Toggle button for Bit 15 (Interact) overlay. */
function interactChipHtml() {
  var on = typeof interactOverlayOn === 'function' && interactOverlayOn();
  return '<button class="rdf rdf-interact' + (on ? ' on' : '') + '" data-edit-act="interact-overlay"'
    + ' title="' + escH('Toggle Bit 15 (Interact) overlay: shows forced 0, forced 1, 1, or 0. Off by default.') + '">Interact</button>';
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
  return '<span class="rg-filter-group rg-seg-group">' + romOverlayButtonHtml('c', 'Collision')
    + '<button class="rdf rg-filter-caret" data-edit-collision-menu="1" title="How collision is drawn"'
    + ' aria-label="How collision is drawn">▾</button>'
    + '<div class="rg-filter-popup" id="rg-collision-dropdown" hidden>'
    + opt('outline', 'Outline', 'The smart outline: each level’s walls as a contour, the wall tint inside')
    + opt('tiles', 'Tile by tile', 'Every pixel a tile makes solid, filled in its level’s colour')
    + '</div></span>';
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
    ],
  });
}

/**
 * Objects: the room's object tiles, one toggle, no menu (§8e — "objects are
 * distinct object tiles. the arrow should be removed"). On a ROM room that
 * is the `o` feature render; on a source room, the objects its script
 * defines. NPCs, hitboxes, grass and the rest moved to More.
 */
function objectFilterGroupHtml(ctx) {
  if (ctx.romId) return romOverlayButtonHtml('o', 'Objects');
  if (ctx.hasObjects) return viewHideBtnHtml('hide-obj', 'Objects', 'Objects defined in this room’s source');
  return '';
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
  if (ctx.hasIngr) subs.push(viewHideBtnHtml('hide-ingr', '🌿 Ingredients', 'Ingredient icons on B-triggers'));
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
 * The bar itself: the mock's six primary slots, then the two actions.
 *
 * `locked` is a verb, not a view filter, so it sits past a divider with its
 * own outline treatment (Phase 6). There is no `edit` any more: every map
 * opens in the editor, and a vanilla one opens locked (detail-renderer.js).
 */
function buildViewFilterBarHtml(ctx) {
  var parts = [
    visSegmentsHtml(ctx),
    triggerFilterGroupHtml(ctx),
    objectFilterGroupHtml(ctx),
    ctx.romId ? buildSpecialFilterChipHtml() : '',
    moreFilterGroupHtml(ctx),
  ].filter(function (h) { return !!h; });
  var acts = ctx.locked === false
    ? '<button class="rdf" id="rg-lock-btn" title="Lock map">unlocked</button>'
    : '<button class="rdf on" id="rg-lock-btn" title="Unlock map">locked</button>';
  return '<div class="rd-filters rg-view-filters">' + parts.join('')
    + '<span class="rdf-sep"></span>' + acts + '</div>';
}

// ── the status bar ────────────────────────────────────────────────────────

/** Two digits, so the read-out does not jitter width as the pointer moves. */
function statusPad2(n) {
  var s = String(Math.abs(n));
  return (n < 0 ? '-' : '') + (s.length < 2 ? '0' + s : s);
}

var STATUS_NO_XY = 'x: -- y: --';

/**
 * The full-width bar under the filter bar: hovered cell, room size, the
 * draft summary, and the hovered entity's own label.
 *
 * `#rg-edit-count` moved here out of the tool pill in Phase 7a — same id,
 * same writer (map-editor-input.js's `editNote` and map-editor-ui.js's
 * `renderEditChrome`), so nothing that writes the status line changed. It is
 * built on every room render rather than only in edit mode, because the
 * coordinate read-out and the hover label are useful while just browsing.
 *
 * `#rg-tip` keeps its id too: interactions.js's setupHoverHighlights writes
 * it, and this only changes where it sits.
 */
function buildStatusBarHtml(opts) {
  var w = opts && opts.widthTiles, h = opts && opts.heightTiles;
  return '<div class="rg-statusbar" id="rg-statusbar">'
    + '<span id="rg-status-xy" title="The metatile cell under the pointer">' + STATUS_NO_XY + '</span>'
    + '<span class="rg-status-sep">·</span>'
    + '<span id="rg-status-size" title="Room size in 16 px metatiles">'
    + (w && h ? w + ' × ' + h : '—') + '</span>'
    + '<span class="rg-status-sep">·</span>'
    + '<span class="rg-edit-count" id="rg-edit-count"></span>'
    + '<span class="rg-status-tip" id="rg-tip"></span>'
    + '</div>';
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

/**
 * Track the pointer's cell into the status bar.
 *
 * Bound **once per `#rg-wrap`** (its own dataset flag, per the
 * webview-dom-safety skill) and in the **capture** phase:
 * map-editor-gestures.js's capture handler on the same node calls
 * `stopPropagation()` mid-stroke, which would starve a bubble-phase listener
 * on an ancestor — but listeners on the same node still all run, so the
 * read-out keeps updating while painting.
 */
function setupStatusBar() {
  var wrap = document.getElementById('rg-wrap');
  if (!wrap || wrap.dataset.statusBound) return;
  wrap.dataset.statusBound = '1';
  function write(text) {
    var el = document.getElementById('rg-status-xy');
    if (el) el.textContent = text;
  }
  wrap.addEventListener('mousemove', function (e) {
    var cell = (typeof editEventCell === 'function') ? editEventCell(e) : null;
    var interactInfo = '';
    if (cell && typeof editCellInteractState === 'function') {
      var st = editCellInteractState(typeof _mtPalette !== 'undefined' ? _mtPalette : null, cell.x, cell.y);
      interactInfo = ' · interact: ' + st;
    }
    write(cell ? 'x: ' + statusPad2(cell.x) + ' y: ' + statusPad2(cell.y) + interactInfo : STATUS_NO_XY);
  }, true);
  wrap.addEventListener('mouseleave', function () { write(STATUS_NO_XY); }, true);
}
