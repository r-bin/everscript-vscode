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
// Owns: _tileGroupPage, _layerForce, _brushFlip.

/** Families shown at once when no family is filtering. */
var TILE_GROUP_PAGE = 6;
var _tileGroupPage = TILE_GROUP_PAGE;

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
 * Families selected means exactly those. Nothing selected means everything
 * the catalogue knows, adopted families first and the rest paged — "all
 * tiles, grouped by family" without rendering 329 sheets to say it.
 */
function tileGroupFamilies() {
  var picked = Object.keys(_chipSel).map(Number);
  if (picked.length) return picked;
  var fams = editFamilies().filter(function (f) { return f !== undefined; });
  if (!_famCatalogue) return fams;
  // `_tileGroupPage` is how many *candidates* to show beyond the adopted
  // ones — not a shared budget the adopted count eats into. Subtracting
  // `fams.length` here used to mean a full palette (7 adopted, the common
  // case) always started at `Math.max(0, 6-7)=0` extra shown, and even
  // after "more families" it only ever grew by however much the increment
  // exceeded 7 — reading as "more families" doing nothing right when you
  // have the most reason to browse past your own seven.
  var rest = _famCatalogue
    .filter(function (f) { return fams.indexOf(f.id) < 0; })
    .sort(function (a, b) { return b.tiles - a.tiles || a.id - b.id; })
    .slice(0, _tileGroupPage)
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

/** One family's art, ordered by relationship, with layer badges. */
function tileGroupHtml(family) {
  var s = _famSheets[family];
  if (!s) { ensureFamilySheet(family); return tileGroupShell(family, null, 'loading…'); }
  if (s === 'pending') return tileGroupShell(family, null, 'loading…');
  if (!s.count) return tileGroupShell(family, null, 'no room draws anything in it');

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
    html += '<i class="rs-mt-cell' + (armed ? ' sel' : '')
      + (badge[0] ? ' rg-lay-' + badge[0] : '') + (rel >= 50 ? ' rg-rel' : '')
      + '" data-fam-tile="' + slot[2] + '" data-fam-of="' + family + '"'
      + ' title="' + escH('graphic ' + slot[2] + ' in family ' + family
        + '\n' + slot[3] + ' placements in vanilla'
        + (badge[0] ? '\ndrawn in the ' + badge[0] + (badge[1] ? ' — ' + badge[1] : '') : '')
        + (rel ? '\ngoes with what you have placed: ' + rel + '%' : '')) + '"'
      + ' style="background-position:-' + x + 'px -' + y + 'px"></i>';
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
function tileGroupShell(family, sheet, badge) {
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
  return '<div class="rg-tile-group"><div class="rg-group-h" title="' + escH(title) + '">'
    + '<b class="rg-group-name">' + family + '</b>'
    + '<span class="rg-group-where">' + escH(meta && meta.areas.length ? meta.areas[0] : '') + '</span>'
    + (slot >= 0 ? '<span class="rg-group-slot">slot ' + (slot + 1) + '</span>'
      : '<span class="rg-group-slot off">not loaded</span>')
    + (badge ? '<span class="rg-group-match">' + escH(badge) + '</span>' : '')
    + '<span class="rg-group-count">'
    + escH(sheet ? String(sheet.count) : '…') + '</span>'
    + '</div>';
}

/**
 * The recommended neighbours of whatever is armed, as the mock's collapsible
 * card — but a ranked list, not its plus-shaped N/E/S/W grid.
 *
 * This is the discovery tool: the other pieces of a gourd score 1.00 — they
 * are always adjacent and never apart — so they arrive at the top, one click
 * from being placed. The ranking is **undirected** (see
 * map-editor-relations.js): drawing it as four compass slots would claim a
 * per-direction measurement the ROM index does not make. The plan doc §8a
 * records that as the open fork.
 */
function neighbourCardHtml() {
  if (!_relatedTop.length) return '';
  var open = _panelOpen.neighbours !== false;
  var top = _relatedTop.slice(0, 16);
  var html = '<div class="rg-nb-card"><div class="rg-sec-h" data-panel="neighbours"'
    + ' title="' + escH('Graphics vanilla draws beside what this draft has placed, best first.\n'
      + 'The score is how often the two are adjacent anywhere — it has no direction.') + '">'
    + '<span class="rg-panel-caret">' + (open ? '▾' : '▸') + '</span>'
    + '<span class="rg-sec-name">likely neighbors</span>'
    + '<span class="rg-sec-count">' + top.length + '</span></div>';
  if (!open) return html + '</div>';

  html += '<div class="rg-nb-grid">';
  for (var i = 0; i < top.length; i++) {
    var g = top[i][0];
    var fam = tileFamilyOf(g);
    html += '<button class="rg-nb' + (fam === null ? ' rg-unknown' : '')
      + '" data-fam-tile="' + g + '" data-fam-of="' + (fam === null ? '' : fam) + '"'
      + ' title="' + escH('graphic ' + g + (fam === null ? ' — family not known yet' : ' — family ' + fam)
        + '\n' + top[i][1] + '% relationship, ' + top[i][2] + ' placements side by side'
        + '\nClick to make it the brush.') + '">'
      + '<b>' + top[i][1] + '%</b><span class="rg-nb-g">' + g + '</span></button>';
  }
  return html + '</div></div>';
}

/** The family a graphic is known to live in, from whatever sheet has it. */
function tileFamilyOf(graphic) {
  var keys = Object.keys(_famSheets);
  for (var i = 0; i < keys.length; i++) {
    var s = _famSheets[keys[i]];
    if (!s || s === 'pending') continue;
    for (var j = 0; j < s.slots.length; j++) {
      if (s.slots[j][2] === graphic) return s.family;
    }
  }
  return null;
}

/** The tile groups, and nothing else — the row and the card are their own. */
function tilesPanel() {
  var families = tileGroupFamilies();
  if (!families.length) {
    return '<div class="rs-note">Nothing selected shows every family; this shows none. '
      + 'Clear the family filter above.</div>';
  }
  var html = '';
  for (var i = 0; i < families.length; i++) html += tileGroupHtml(families[i]);

  if (!Object.keys(_chipSel).length && _famCatalogue && _famCatalogue.length > families.length) {
    html += '<button class="rg-fam-more" data-tile-more="1"'
      + ' title="Show more families, most art first">'
      + (_famCatalogue.length - families.length) + ' more families</button>';
  }
  return html;
}
