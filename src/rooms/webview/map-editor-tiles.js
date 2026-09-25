// Ownership: the tile browser — every graphic you could place, grouped by
// the family that colours it and ordered by what it is drawn beside — plus
// the two brush modifiers the Tile tab's segmented row carries.
//
// Two independent signals, which is why both are used. Family says *what
// colours this can be drawn in*; relationship says *what the artists
// actually put beside it*. Only 38.1% of vanilla's neighbour pairs share a
// dominant family, so grouping by one and ranking by the other is not a
// tautology — see docs/map-format/map-editor-window.md §2.2.
//
// Owns: _tileObserver, _tileOrder, _tileOrderFor, _layerForce, _brushFlip.
//
// **Every tile, no pager, nothing collapsible** (§8e): "the tile list cannot
// be collapsed, we always show all available tiles" and "show more is not
// good UX … use lazy loading". A group is drawn at its final height from the
// catalogue's tile count before its sheet exists, and the sheet is fetched
// only when the group scrolls near the view — so 329 families cost a few
// requests, and nothing below moves when one arrives.

/**
 * Loads a family's sheet as its placeholder nears the visible part of the
 * list. Rebuilt on every render, because every render replaces the nodes it
 * was watching.
 */
var _tileObserver = null;
/** How far outside the view a group starts loading, in px. */
var TILE_LAZY_MARGIN = 600;

/** One swatch is 16px art at 2x, plus shared.css's margin: 32px; 4px gutters. */
var TILE_PITCH = 36;
var TILE_BOX = 32;
/** The sheet frame: 4px padding and a 1px border, each side. */
var TILE_FRAME = 10;

/** Height a group's sheet will have, so the placeholder is that tall already. */
function tileSheetHeight(count, width) {
  var perRow = Math.max(1, Math.floor((width - TILE_FRAME + 4) / TILE_PITCH));
  var rows = Math.max(1, Math.ceil(count / perRow));
  return rows * TILE_BOX + (rows - 1) * 4 + TILE_FRAME;
}

/** Watch every placeholder in the Tile tab and fetch what comes near. */
function tileLazyObserve() {
  if (_tileObserver) { _tileObserver.disconnect(); _tileObserver = null; }
  var body = document.getElementById('rg-tab-body');
  if (!body) return;
  var lazy = body.querySelectorAll('[data-lazy-fam]');
  if (!lazy.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    // No observer (an old host): load the first screenful, never all 329.
    for (var i = 0; i < Math.min(lazy.length, 8); i++) ensureFamilySheet(Number(lazy[i].dataset.lazyFam));
    return;
  }
  _tileObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      _tileObserver.unobserve(e.target);
      ensureFamilySheet(Number(e.target.dataset.lazyFam));
    });
  }, { root: body, rootMargin: TILE_LAZY_MARGIN + 'px 0px' });
  for (var j = 0; j < lazy.length; j++) _tileObserver.observe(lazy[j]);
}

/**
 * Force the next placement onto a layer, or null to follow vanilla.
 *
 * "You can draw all tiles in the foreground or background" is literally
 * true of the format — a tilemap word does not care which of the two layer
 * slots it is written into — so this is an override, not a filter.
 *
 * Declared here rather than in map-editor-chips.js (where it used to live)
 * because this file renders the control: it and `_brushFlip` are one
 * concern, "how the tile you click becomes a brush", and
 * map-editor-families.js's editUseFamilyTile reads both.
 */
var _layerForce = null;

/**
 * Mirror the next placement horizontally and/or vertically.
 *
 * Bit 14 of a tilemap word is the horizontal flip and bit 15 the vertical
 * one (`docs/map-format/map_rendering_pipeline.md` §3), and `renderVramLayer`
 * (src/maps/render.ts) reads exactly those two bits back out per word and
 * applies them to the whole 16×16 graphic — so a word this ORs them into
 * renders mirrored on the canvas and in the composed preview alike, with no
 * second code path. `docs/map-format/building-a-room-from-a-picture.md` §9.1
 * is the rule being followed: "priority and the two flips are geometry, not
 * identity", so they ride along in the word rather than naming a different
 * graphic. §6 of the same doc counts the matcher's search space as
 * "graphics × families × **4 flip combinations**", i.e. the format treats a
 * mirrored tile as a legal variant of the same art rather than new art.
 *
 * What it costs: a mirrored word is a different word, so a stamp made from
 * one is a different dictionary entry (`editAddStamp` dedupes on all three
 * words) — eight bytes of the grid-plus-dictionary window. It costs **no**
 * graphics slot: `editAdoptGraphic` keys on the graphic id, which a flip
 * does not change. Mirroring is free art, which is the whole reason it is
 * worth having.
 */
var BRUSH_FLIP_H = 0x4000;
var BRUSH_FLIP_V = 0x8000;
var _brushFlip = { h: false, v: false };

/** The mirror bits a freshly picked tile's word should carry. */
function editBrushFlipBits() {
  return (_brushFlip.h ? BRUSH_FLIP_H : 0) | (_brushFlip.v ? BRUSH_FLIP_V : 0);
}

/**
 * Which families the list is showing.
 *
 * Families selected means exactly those. Otherwise the adopted families
 * always, plus a page of unadopted candidates **only while a palette slot is
 * free**.
 *
 * That gate is the whole rule, and §8a.3 reversed §8a.1 to get it: "if the
 * tile family list is full (7/7) we don't show tiles from families outside
 * that list". Seven is a hard ceiling (`editAdoptFamilyFor`), so with no free
 * slot a candidate's tiles are tiles you cannot draw with — clicking one only
 * produces "all seven palette slots are taken". §8a.1 read an earlier report
 * as a pagination bug and made candidates show unconditionally; the report
 * meant the opposite, and offering ~320 unusable families is exactly the
 * noise the Tile tab rebuild (§8a) set out to remove. Free a slot and they
 * come back, because then adopting one is something that can happen.
 */
function tileGroupFamilies() {
  return tileStableOrder(tileGroupFamiliesWanted());
}

/**
 * The order the groups were last drawn in, and the draft it was for.
 *
 * "I dont like that tiles in the tiles list are jumping when you click on
 * them" (§8e): clicking a tile from a family not yet in a slot adopts it,
 * and adopted families list first — so the group you clicked in leapt to
 * the top. Now a group keeps the place it was shown in; only families the
 * list has not shown before are placed by the rule.
 */
var _tileOrder = [];
var _tileOrderFor = null;

function tileStableOrder(want) {
  var d = editDraft();
  if (_tileOrderFor !== d) { _tileOrderFor = d; _tileOrder = []; }
  var wanted = {};
  want.forEach(function (f) { wanted[f] = true; });
  var kept = _tileOrder.filter(function (f) { return wanted[f]; });
  var seen = {};
  kept.forEach(function (f) { seen[f] = true; });
  _tileOrder = kept.concat(want.filter(function (f) { return !seen[f]; }));
  return _tileOrder.slice();
}

/** Which families should be listed, in the order a fresh list puts them. */
function tileGroupFamiliesWanted() {
  var picked = Object.keys(_chipSel).map(Number);
  if (picked.length) return picked;
  var fams = editFamilies().filter(function (f) { return f !== undefined; });
  if (!_famCatalogue || editFreeFamilySlot() < 0) return fams;
  // Every candidate, most art first — no page size (§8e). The list is lazy,
  // so listing all 329 costs headers and placeholders, not sheets.
  var rest = _famCatalogue
    .filter(function (f) { return fams.indexOf(f.id) < 0; })
    .sort(function (a, b) { return b.tiles - a.tiles || a.id - b.id; })
    .map(function (f) { return f.id; });
  return fams.concat(rest);
}

/**
 * Which layer a picked tile will land on, and why.
 *
 * `_layerForce` is an explicit override. Otherwise vanilla decides where it
 * is one-sided enough — 4822 of 5628 graphics are drawn on one layer at
 * least 90% of the time — and the phase only breaks the tie.
 */
function tileLayerBadge(graphic) {
  if (_layerForce) return [_layerForce === 'canopy' ? 'front' : 'ground', 'forced'];
  var stats = _famLayerHint[graphic];
  if (!stats) return ['', ''];
  var total = stats[0] + stats[1];
  if (!total) return ['', ''];
  var share = Math.max(stats[0], stats[1]) / total;
  if (share < 0.6) return ['', ''];
  return [stats[0] > stats[1] ? 'front' : 'ground', Math.round(share * 100) + '% in vanilla'];
}

/**
 * One segmented pill, the mock's `filterSegStyle`.
 *
 * `opts` is `[value, label, title]` triples; `key` is the dataset name the
 * delegated handler in map-editor-input.js dispatches on.
 *
 * `rg-tile-seg`, not `rg-seg`: the filter bar under the canvas already owns
 * `.rg-seg` for its Background|Foreground|Collision group (the mock's
 * `tileVisGroup.wrapStyle`, hairline-divided, no inner padding), which is a
 * different look from this one (`filterSegStyle`, padded, rounded inner
 * buttons). Reusing the name silently restyled that bar — caught by the
 * regression test that counts the pills in this row.
 */
function tileSegHtml(key, opts, isOn) {
  var html = '<div class="rg-tile-seg">';
  for (var i = 0; i < opts.length; i++) {
    html += '<button class="rg-tile-seg-b' + (isOn(opts[i][0]) ? ' on' : '')
      + '" data-' + key + '="' + opts[i][0] + '"'
      + ' title="' + escH(opts[i][2]) + '">' + opts[i][1] + '</button>';
  }
  return html + '</div>';
}

/**
 * The filter row: which layer a pick lands on, and whether it is mirrored.
 *
 * Two pills, which is what the mock draws — but not the mock's two. Its
 * `Auto|All` segment is a *scope* toggle (show only loaded families vs all of
 * them); ours is the "N more" pager below, and it stays a pager because "all"
 * here would mean one host round-trip per family for 329 families. See the
 * plan doc §8a.
 */
function tileFilterRowHtml() {
  return '<div class="rg-tile-seg-row">'
    + tileSegHtml('layer-force', [
      ['auto', 'auto', 'Put each tile on the layer vanilla draws it on'],
      ['canopy', 'front', 'Draw every picked tile over whatever it lands on'],
      ['terrain', 'ground', 'Draw every picked tile as the ground'],
    ], function (v) { return (_layerForce || 'auto') === v; })
    + tileSegHtml('brush-flip', [
      ['h', 'H', 'Mirror the picked tile left-to-right (bit 14 of its word).\n'
        + 'A mirrored tile is one more dictionary entry and no extra graphic.'],
      ['v', 'V', 'Mirror the picked tile top-to-bottom (bit 15 of its word).\n'
        + 'A mirrored tile is one more dictionary entry and no extra graphic.'],
    ], function (v) { return !!_brushFlip[v]; })
    + '</div>';
}

/** Flip the brush, and re-arm it so the toggle is visibly live. */
function brushFlipToggle(axis) {
  if (axis !== 'h' && axis !== 'v') return;
  _brushFlip[axis] = !_brushFlip[axis];
  // Re-picking the same tile rebuilds its word with the new bits and, via
  // editAddStamp's find-or-create, either reuses the mirrored entry or makes
  // it once. Flipping back reuses the original — no entry per click.
  if (_brushTile) editUseFamilyTile(_brushTile.graphic, _brushTile.family);
  else renderEditChrome();
}

/**
 * Draw the armed brush on the other layer — the neighbour card's centre.
 *
 * The mock's `toggleDrawLayer`: it flips the explicit override to the
 * opposite of the layer the brush is *actually* on, then re-arms, exactly as
 * brushFlipToggle does, so the brush and the `auto|front|ground` pill both
 * show the change. It lives here because this file owns `_layerForce`, and
 * the override is sticky on purpose — it is the same state the pill sets.
 */
function brushLayerToggle() {
  var c = nbCentre();
  if (!c) return;
  _layerForce = c.layer === 'canopy' ? 'terrain' : 'canopy';
  editUseFamilyTile(c.graphic, c.family);
}

/** One family's art, ordered by relationship, with layer badges. */
function tileGroupHtml(family, width) {
  var s = _famSheets[family];
  // Not here yet: the group at its final height, so nothing below moves when
  // the sheet lands. tileLazyObserve fetches it once it nears the view.
  if (!s || s === 'pending') {
    var meta = chipMeta(family);
    var n = meta && meta.tiles ? meta.tiles : 1;
    return tileGroupShell(family, null, '', n)
      + '<div class="rg-group-sheet rg-group-lazy"' + (s ? '' : ' data-lazy-fam="' + family + '"')
      + ' style="height:' + tileSheetHeight(n, width || 360) + 'px"></div></div>';
  }
  // Closes the group's own div — tileGroupShell leaves it open for the sheet.
  if (!s.count) return tileGroupShell(family, null, 'no room draws anything in it') + '</div>';

  // Sorted by how well each tile goes with what is already in the map, then
  // by how often vanilla places it — which is also the whole ordering on an
  // empty map, where there is nothing to be related to yet.
  var order = s.slots.slice().sort(function (a, b) {
    return relatedScore(b[2]) - relatedScore(a[2]) || b[3] - a[3] || a[2] - b[2];
  });

  var best = order.length ? relatedScore(order[0][2]) : 0;
  var html = tileGroupShell(family, s, best ? best + '%' : '')
    + '<div class="rs-mt-sheet rg-group-sheet" style="--mt-sheet:url(' + s.imageUri
    + ');--mt-cell:' + s.cell + 'px"><div class="rs-mt-grid">';

  for (var i = 0; i < order.length; i++) {
    var slot = order[i];
    var at = s.slots.indexOf(slot);
    var x = (at % s.columns) * s.cell;
    var y = Math.floor(at / s.columns) * s.cell;
    var armed = _brushTile && _brushTile.graphic === slot[2] && _brushTile.family === family;
    var badge = tileLayerBadge(slot[2]);
    var rel = relatedScore(slot[2]);
    // The armed swatch is the one "what you're about to paint" preview this
    // tab has (§8a.2 item 2) — H/V wrote the mirror bits into the exported
    // word from the start (§8a), but nothing mirrored the picture you were
    // looking at, so the swatch and the paint disagreed. A candidate swatch
    // you have not picked yet stays unflipped: it is showing you the art,
    // not a commitment.
    var flipCls = armed ? (_brushFlip.h ? ' rg-flip-h' : '') + (_brushFlip.v ? ' rg-flip-v' : '') : '';
    html += '<i class="rs-mt-cell' + (armed ? ' sel' : '')
      + (badge[0] ? ' rg-lay-' + badge[0] : '') + (rel >= 50 ? ' rg-rel' : '') + flipCls
      + '" data-fam-tile="' + slot[2] + '" data-fam-of="' + family + '"'
      + ' title="' + escH('graphic ' + slot[2] + ' in family ' + family
        + '\n' + slot[3] + ' placements in vanilla'
        + (badge[0] ? '\ndrawn in the ' + badge[0] + (badge[1] ? ' — ' + badge[1] : '') : '')
        + (rel ? '\ngoes with what you have placed: ' + rel + '%' : '')
        + (typeof tileCollisionTitle === 'function' ? tileCollisionTitle(slot) : '')) + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px">'
      + (typeof tileCollisionMarkHtml === 'function' ? tileCollisionMarkHtml(slot) : '') + '</i>';
  }
  return html + '</div></div></div>';
}

/**
 * A group header: a name on the left, a count on the right.
 *
 * The facts are the ones the old sentence carried — id, area, palette slot,
 * how much art, how well it matches — but laid out as a header rather than
 * read out as prose. "The N most-used shown" is only ever true of a huge
 * family and moved to the tooltip; the names stay ids and areas, because
 * that is what the ROM has (a family has no name to invent).
 */
function tileGroupShell(family, sheet, badge, expected) {
  var fams = editFamilies();
  var slot = fams.indexOf(family);
  var meta = chipMeta(family);
  var title = 'Family ' + family
    + (meta && meta.areas.length ? '\n' + meta.areas.join(', ') : '')
    + (meta && meta.names.length ? '\n' + meta.names.slice(0, 3).join('\n') : '')
    + (slot >= 0 ? '\nin palette slot ' + (slot + 1) : '\nnot loaded — clicking a tile adopts it')
    + (sheet ? '\n' + sheet.total + ' graphic' + (sheet.total === 1 ? '' : 's')
      + (sheet.count < sheet.total ? ', the ' + sheet.count + ' most-used shown' : '') : '')
    + (badge ? '\nbest match with what you have placed: ' + badge : '');
  return '<div class="rg-tile-group" data-group-fam="' + family + '">'
    + '<div class="rg-group-h" title="' + escH(title) + '">'
    + '<b class="rg-group-name">' + family + '</b>'
    + '<span class="rg-group-where">' + escH(meta && meta.areas.length ? meta.areas[0] : '') + '</span>'
    + (slot >= 0 ? '<span class="rg-group-slot">slot ' + (slot + 1) + '</span>'
      : '<span class="rg-group-slot off">not loaded</span>')
    + (badge ? '<span class="rg-group-match">' + escH(badge) + '</span>' : '')
    + '<span class="rg-group-count">'
    + escH(sheet ? String(sheet.count) : expected ? String(expected) : '…') + '</span>'
    + '</div>';
}

/** The tile groups, and nothing else — the row and the card are their own. */
function tilesPanel() {
  var families = tileGroupFamilies();
  if (!families.length) {
    return '<div class="rs-note">' + (Object.keys(_chipSel).length
      ? 'Nothing in the selected families. Clear the family filter above.'
      : 'loading the families…') + '</div>';
  }
  // The width the sheets will wrap at: the list's own, known before this
  // render replaces it. Placeholder heights are only honest against it.
  var body = document.getElementById('rg-tab-body');
  var width = body && body.clientWidth ? body.clientWidth - 4 : 360;
  var html = '';
  for (var i = 0; i < families.length; i++) html += tileGroupHtml(families[i], width);
  return html;
}
