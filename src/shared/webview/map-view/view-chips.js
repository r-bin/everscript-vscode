// Ownership: the map views' filter-bar controls — a toggle chip, the segmented
// pill (BG | FG | Collision in Evermore's Rooms tab, Layer 1 | Layer 2 | Collision
// in the Secret of Mana Maps panel) and a chip with a caret menu. Shared by both;
// styled by map-view.css. Plain browser script: defines globals. Builds markup
// only — each page binds its own clicks and owns the state a chip shows.

function mapViewEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A toggle chip. `c.attrs` become data-* attributes (`{ 'vis-layer': 'bg' }` ->
 * `data-vis-layer="bg"`); `c.cls` extra classes; `c.on` the lit state.
 */
function mapViewChipHtml(c) {
  var attrs = '';
  Object.keys(c.attrs || {}).forEach(function (k) {
    attrs += ' data-' + k + '="' + mapViewEsc(c.attrs[k]) + '"';
  });
  if (c.id) attrs = ' id="' + mapViewEsc(c.id) + '"' + attrs;
  return '<button class="rdf' + (c.cls ? ' ' + c.cls : '') + (c.on ? ' on' : '') + '"' + attrs
    + ' title="' + mapViewEsc(c.title || '') + '">' + mapViewEsc(c.label) + '</button>';
}

/** Several chips as one bordered, hairline-divided group. */
function mapViewSegHtml(parts) {
  return '<span class="rg-seg">' + parts.join('') + '</span>';
}

/**
 * A chip plus a caret opening a popup of options (`menu.attr` marks the caret,
 * `menu.id` the popup). Inside a segmented pill it keeps the pill's look.
 */
function mapViewMenuChipHtml(chipHtml, menu) {
  return '<span class="rg-filter-group rg-seg-group">' + chipHtml
    + '<button class="rdf rg-filter-caret" data-' + menu.attr + '="1" title="' + mapViewEsc(menu.title)
    + '" aria-label="' + mapViewEsc(menu.title) + '">▾</button>'
    + '<div class="rg-filter-popup" id="' + mapViewEsc(menu.id) + '" hidden>' + menu.options.join('') + '</div></span>';
}
