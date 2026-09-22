// Ownership: the tile browser — every graphic you could place, grouped by
// the family that colours it and ordered by what it is drawn beside.
//
// Two independent signals, which is why both are used. Family says *what
// colours this can be drawn in*; relationship says *what the artists
// actually put beside it*. Only 38.1% of vanilla's neighbour pairs share a
// dominant family, so grouping by one and ranking by the other is not a
// tautology — see docs/map-format/map-editor-window.md §2.2.
//
// Owns: _tileGroupPage.

/** Families shown at once when no chip is filtering. */
var TILE_GROUP_PAGE = 6;
var _tileGroupPage = TILE_GROUP_PAGE;

/**
 * Which families the list is showing.
 *
 * Chips selected means exactly those. Nothing selected means everything the
 * catalogue knows, adopted families first and the rest paged — "all tiles,
 * grouped by family" without rendering 329 sheets to say it.
 */
function tileGroupFamilies() {
  var picked = Object.keys(_chipSel).map(Number);
  if (picked.length) return picked;
  var fams = editFamilies().filter(function (f) { return f !== undefined; });
  if (!_famCatalogue) return fams;
  var rest = _famCatalogue
    .filter(function (f) { return fams.indexOf(f.id) < 0; })
    .sort(function (a, b) { return b.tiles - a.tiles || a.id - b.id; })
    .slice(0, Math.max(0, _tileGroupPage - fams.length))
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

/** The two override buttons plus what they are overriding. */
function tileLayerBarHtml() {
  var opts = [
    [null, 'auto', 'Put each tile on the layer vanilla draws it on'],
    ['canopy', 'front', 'Draw every picked tile over whatever it lands on'],
    ['terrain', 'ground', 'Draw every picked tile as the ground'],
  ];
  var html = '<div class="rd-filters">';
  for (var i = 0; i < opts.length; i++) {
    html += '<button class="rdf' + (_layerForce === opts[i][0] ? ' on' : '')
      + '" data-layer-force="' + (opts[i][0] || 'auto') + '"'
      + ' title="' + escH(opts[i][2]) + '">' + opts[i][1] + '</button>';
  }
  return html + '</div>';
}

/** One family's art, ordered by relationship, with layer badges. */
function tileGroupHtml(family) {
  var s = _famSheets[family];
  if (!s) { ensureFamilySheet(family); return tileGroupShell(family, 'loading…'); }
  if (s === 'pending') return tileGroupShell(family, 'loading…');
  if (!s.count) return tileGroupShell(family, 'no room draws anything in it');

  // Sorted by how well each tile goes with what is already in the map, then
  // by how often vanilla places it — which is also the whole ordering on an
  // empty map, where there is nothing to be related to yet.
  var order = s.slots.slice().sort(function (a, b) {
    return relatedScore(b[2]) - relatedScore(a[2]) || b[3] - a[3] || a[2] - b[2];
  });

  var best = order.length ? relatedScore(order[0][2]) : 0;
  var html = tileGroupShell(family, s.total + ' graphic' + (s.total === 1 ? '' : 's')
    + (s.count < s.total ? ', the ' + s.count + ' most-used shown' : '')
    + (best ? ' · best match ' + best + '%' : ''))
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

function tileGroupShell(family, note) {
  var fams = editFamilies();
  var slot = fams.indexOf(family);
  var meta = (_famCatalogue || []).filter(function (f) { return f.id === family; })[0];
  return '<div class="rg-tile-group"><div class="rs-note rg-group-h">'
    + '<b>' + family + '</b> ' + escH(meta && meta.areas.length ? meta.areas.join(', ') : '')
    + (slot >= 0 ? ' <span class="rg-ok">slot ' + (slot + 1) + '</span>'
      : ' <span class="rg-chip-add-note">not loaded</span>')
    + ' <span class="rs-note">' + escH(note) + '</span></div>';
}

/**
 * The recommended neighbours of whatever is armed.
 *
 * This is the discovery tool: the other pieces of a gourd score 1.00 — they
 * are always adjacent and never apart — so they arrive at the top, one
 * click from being placed.
 */
function neighbourStripHtml() {
  if (!_relatedTop.length) return '';
  var top = _relatedTop.slice(0, 16);
  var html = '<div class="rs-note">Drawn next to what you have placed, in vanilla:</div>'
    + '<div class="rg-chips rg-neighbours">';
  for (var i = 0; i < top.length; i++) {
    var g = top[i][0];
    var fam = tileFamilyOf(g);
    html += '<button class="rg-chip-main rg-neighbour' + (fam === null ? ' rg-unknown' : '')
      + '" data-fam-tile="' + g + '" data-fam-of="' + (fam === null ? '' : fam) + '"'
      + ' title="' + escH('graphic ' + g + (fam === null ? '' : ' — family ' + fam)
        + '\n' + top[i][1] + '% relationship, ' + top[i][2] + ' placements side by side') + '">'
      + '<b>' + top[i][1] + '%</b> <span class="rg-chip-where">' + g + '</span></button>';
  }
  return html + '</div>';
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

/** The whole tile panel. */
function tilesPanel(p) {
  ensureRelated();
  var families = tileGroupFamilies();
  var html = tileLayerBarHtml() + neighbourStripHtml();
  if (!families.length) {
    return html + '<div class="rs-note">No families to show — pick a chip above.</div>';
  }
  html += '<div class="rs-note">Clicking a tile makes a metatile from it and adopts its '
    + 'family if you do not have it.</div>';
  for (var i = 0; i < families.length; i++) html += tileGroupHtml(families[i]);

  if (!Object.keys(_chipSel).length && _famCatalogue && _famCatalogue.length > families.length) {
    html += '<div class="rd-filters"><button class="rdf" data-tile-more="1">'
      + 'more families (' + (_famCatalogue.length - families.length) + ' left)</button></div>';
  }
  return html;
}
