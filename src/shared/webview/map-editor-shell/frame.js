// Ownership: the markup of the editor shell — the page frame (rail | splitter | detail), the rail, the
// detail header, the canvas column (card, svg, zoom chip, filter bar, status bar), the floating tool
// pill and its buttons, the status bar, the dock's tab strip, and mounting the dock beside the canvas.
// Game-neutral: the Evermore Rooms tab and the Secret of Mana editor both build their page from these,
// so the two look and behave alike; each passes its own content (rooms, tools, tabs, svg) in.
// Plain browser script (globals); under Node (`module.exports`) the Rooms tab's host uses the string
// builders to render the page it sends. No DOM is touched except in shellDockMount / shellDockUnmount.
//
// Look: shell-*.css. Behaviour: layout.js, zoom-pan.js, pan.js, rail.js, status.js.

function shellEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The page: the rail, its splitter, and the detail column (`#room-detail`) the page fills.
 * `o.railHtml` is shellRailHtml; `o.placeholder` what the detail says before anything is open.
 */
function shellFrameHtml(o) {
  return '<div class="rm-panels">'
    + o.railHtml
    // The handle that resizes the rail (layout.js).
    + '<div class="rm-split" data-split="rail" title="Drag to resize"></div>'
    + '<div class="rm-right"><div id="room-detail" class="rm-detail-placeholder"><span>'
    + shellEscape(o.placeholder || 'Select a room') + '</span></div></div>'
    + '</div>';
}

/**
 * The rail: a search field, collapsible groups of rows, and an optional footer button.
 *   o.groups  [{key, label, title, open, body}]  `body` is the rows' markup (`ul > li.rn-map`)
 *   o.search  {placeholder, label}               defaults to "Search rooms"
 *   o.noneText  what the empty filter says       defaults to "No rooms match"
 *   o.foot    {label, title} | null              the `#rm-new-map` button
 */
function shellRailHtml(o) {
  var search = o.search || {};
  var ph = shellEscape(search.placeholder || 'Search rooms'), lab = shellEscape(search.label || search.placeholder || 'Search rooms');
  var group = function (g) {
    return '<div class="rm-grp" id="rm-grp-' + g.key + '">'
      + '<button class="rm-grp-h" data-rail-grp="' + g.key + '"'
      + ' aria-expanded="' + (g.open ? 'true' : 'false') + '"'
      + ' aria-controls="rm-' + g.key + '-tree" title="' + shellEscape(g.title || '') + '">'
      + '<span class="rm-grp-chev" aria-hidden="true">' + (g.open ? '▾' : '▸') + '</span>'
      + shellEscape(g.label) + '</button>'
      + '<div class="rm-grp-body" id="rm-' + g.key + '-tree"' + (g.open ? '' : ' hidden') + '>'
      + g.body + '</div></div>';
  };
  return '<div class="rm-left rm-rail rg-rail">'
    + '<div class="rm-rail-search">'
    + '<input id="rm-rail-q" class="rm-rail-q" type="search" autocomplete="off"'
    + ' spellcheck="false" placeholder="' + ph + '" aria-label="' + lab + '">'
    + '</div>'
    + '<div class="rm-rail-scroll" id="rm-rail-scroll">'
    + (o.groups || []).map(group).join('')
    + '<div class="rm-rail-none" id="rm-rail-none" hidden>' + shellEscape(o.noneText || 'No rooms match') + '</div>'
    + '</div>'
    + (o.foot ? '<div class="rm-rail-foot">'
      + '<button class="rm-rail-new" id="rm-new-map" title="' + shellEscape(o.foot.title || '') + '">'
      + shellEscape(o.foot.label) + '</button>'
      + '</div>' : '')
    + '</div>';
}

/**
 * The detail header: the name, small tags, and the actions at the right end (`#rg-head-acts`).
 *   o.name   the title; `o.nameHtml` instead when it is markup (an input)
 *   o.tags   [{cls, text}] small labels after the name; `o.tagsHtml` instead when already markup
 */
function shellHeadHtml(o) {
  var html = '<div class="rd-head"><div class="rd-head-titles">';
  html += o.nameHtml || '<span class="rd-name">' + shellEscape(o.name || '') + '</span>';
  html += o.tagsHtml || (o.tags || []).map(function (t) {
    return '<span class="' + t.cls + '">' + shellEscape(t.text) + '</span>';
  }).join('');
  html += '</div>';
  html += '<span class="rd-head-acts" id="rg-head-acts">' + (o.actsHtml || '') + '</span>';
  return html + '</div>';
}

/**
 * The canvas column in two halves, so a page can write the svg's contents in between:
 * `open` ends with the `<svg>` start tag, `close` starts with its end tag and runs to the column's end.
 *   o.dispW, o.dispH   the viewport's initial size in px (the layout then fills the space)
 *   o.viewBox          "x y w h" of the svg
 *   o.filtersHtml      the filter bar, floating over the map's bottom edge
 *   o.statusHtml       shellStatusbarHtml, the column's floor
 *   o.zoomTitle        the zoom read-out's tooltip
 */
function shellCanvasParts(o) {
  var open = '<div class="rg-outer rs-map" id="rg-outer">'
    // The canvas zone centres one rounded, bordered, shadowed card in empty space, per the design mock.
    // The floating tool pill hangs off the card's top edge and the zoom chip sits inside its corner, which
    // is why the card (not #rg-outer) establishes the positioning context for both.
    + '<div class="rg-canvas-zone" id="rg-canvas-zone">'
    + '<div class="rg-canvas-card" id="rg-canvas-card">'
    + '<div class="rg-wrap" id="rg-wrap" style="width:' + o.dispW + 'px;height:' + o.dispH + 'px">'
    + '<div id="rg-canvas" style="position:absolute;width:' + o.dispW + 'px;height:' + o.dispH + 'px;transform-origin:0 0;will-change:transform">'
    + '<svg class="rg-svg" id="rg-svg" width="' + o.dispW + '" height="' + o.dispH + '" viewBox="' + o.viewBox + '">';
  var close = '</svg></div></div>'   // svg, rg-canvas, rg-wrap
    // The zoom chip: a read-out of the current level plus the three controls that change it (zoom-pan.js).
    + '<div class="rg-zoom" id="rg-zoom">'
    + '<button id="rg-zout" title="Zoom out" aria-label="zoom out">−</button>'
    + '<span class="rg-zoom-level" id="rg-zoom-level" title="' + shellEscape(o.zoomTitle
      || 'Zoom — 100% is one ROM pixel per screen pixel. Ctrl/⌘ + scroll over the map to pinch.') + '">—</span>'
    + '<button id="rg-zin" title="Zoom in" aria-label="zoom in">+</button>'
    + '<button id="rg-zfit" title="Fit the whole room in the frame">fit</button>'
    + '</div>'
    // The filter bar floats over the map's bottom edge, like the tool pill over its top.
    + (o.filtersHtml || '')
    + '</div></div>'   // rg-canvas-card, rg-canvas-zone
    + (o.statusHtml || '')
    + '</div>';        // rg-outer
  return { open: open, close: close };
}

/** One glyph per tool, since the pill is icon-only; both games' editors draw their tools with these. */
var SHELL_TOOL_ICONS = {
  select: '↖', paint: '✎', erase: '⌫', pick: '⤵',
  copy: '⧉', move: '✥', stamp: '❖',
};

/** One tool button of the pill. `o`: {key, icon, tip, label, on, off, badge}. */
function shellToolButtonHtml(o) {
  return '<button class="rdf rg-edit-tool-icon' + (o.on ? ' on' : '')
    + '" data-edit-tool="' + o.key + '" data-tip="' + shellEscape(o.tip) + '" aria-label="' + shellEscape(o.label) + '"'
    + (o.off ? ' disabled' : '') + '>'
    + '<span class="rg-edit-icon" aria-hidden="true">' + o.icon + '</span>' + (o.badge || '') + '</button>';
}

/** One action button of the pill (undo, redo, …). `o`: {act, icon, tip, label, disabled}. */
function shellActButtonHtml(o) {
  return '<button class="rdf rg-edit-tool-icon" data-edit-act="' + o.act + '" data-tip="' + shellEscape(o.tip)
    + '" aria-label="' + shellEscape(o.label) + '"' + (o.disabled ? ' disabled' : '') + '>'
    + '<span class="rg-edit-icon" aria-hidden="true">' + o.icon + '</span></button>';
}

/**
 * The floating tool pill inside its wrapper `#rg-edit-chrome` (which a page replaces in one outerHTML
 * write): `groups` is an array of arrays of button markup, a thin divider between groups; `tailHtml`
 * follows the pill inside the wrapper (the Evermore level bar).
 */
function shellPillHtml(groups, tailHtml) {
  var html = '<div class="rg-edit-chrome" id="rg-edit-chrome">'
    + '<div class="rd-filters rg-edit-bar" id="rg-edit-bar">';
  groups.forEach(function (g, i) {
    if (i) html += '<span class="rg-edit-divider"></span>';
    html += '<span class="rg-edit-group">' + g.join('') + '</span>';
  });
  return html + '</div>' + (tailHtml || '') + '</div>';
}

/** Two digits, so the read-out does not jitter width as the pointer moves. */
function statusPad2(n) {
  var s = String(Math.abs(n));
  return (n < 0 ? '-' : '') + (s.length < 2 ? '0' + s : s);
}

var STATUS_NO_XY = 'x: -- y: --';

/**
 * The full-width bar under the filter bar: hovered cell, the map's size, a note line (`#rg-edit-count`,
 * what editing says), and the hovered thing's own label (`#rg-tip`).
 *   o.width, o.height   the map's size in cells; o.cellTitle / o.sizeTitle the tooltips
 */
function shellStatusbarHtml(o) {
  o = o || {};
  var w = o.width, h = o.height;
  return '<div class="rg-statusbar" id="rg-statusbar">'
    + '<span id="rg-status-xy" title="' + shellEscape(o.cellTitle || 'The metatile cell under the pointer') + '">' + STATUS_NO_XY + '</span>'
    + '<span class="rg-status-sep">·</span>'
    + '<span id="rg-status-size" title="' + shellEscape(o.sizeTitle || 'Room size in 16 px metatiles') + '">'
    + (w && h ? w + ' × ' + h : '—') + '</span>'
    + '<span class="rg-status-sep">·</span>'
    + '<span class="rg-edit-count" id="rg-edit-count"></span>'
    + '<span class="rg-status-tip" id="rg-tip"></span>'
    + '</div>';
}

/**
 * The side bar: a vertical pill on the card's edge with a heading and one round button per choice.
 *   o.id, o.cls   the bar's id and extra class (`rg-variant-bar`); o.label the heading; o.aria its aria-label
 *   o.items       [{text, attr: {'edit-level': 2}, on, tip, color, disabled}]  `color` is the button's accent
 */
function shellSideBarHtml(o) {
  var html = '<div class="rg-level-bar' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '')
    + ' role="radiogroup" aria-label="' + shellEscape(o.aria || o.label) + '">'
    + '<span class="rg-level-h">' + shellEscape(o.label) + '</span>';
  o.items.forEach(function (it) {
    var attrs = '';
    Object.keys(it.attr || {}).forEach(function (k) { attrs += ' data-' + k + '="' + shellEscape(it.attr[k]) + '"'; });
    html += '<button class="rg-level-b' + (it.on ? ' on' : '') + '"' + attrs
      + ' style="--lv:' + it.color + '" role="radio" aria-checked="' + !!it.on + '"'
      + ' data-tip="' + shellEscape(it.tip || '') + '"' + (it.disabled ? ' disabled' : '') + '>' + shellEscape(it.text) + '</button>';
  });
  return html + '</div>';
}

/**
 * The strip of tabs at the top of the dock. `tabs`: [{value, label, on}]; each button carries
 * `data-<attr>="value"` (default `edit-active-tab`, the Evermore editor's delegated click key).
 */
function shellTabStripHtml(tabs, attr) {
  var a = attr || 'edit-active-tab';
  return '<div class="rg-tabstrip" id="rg-tabstrip">' + tabs.map(function (t) {
    return '<button class="rg-tab' + (t.on ? ' on' : '') + '" data-' + a + '="' + t.value + '">' + shellEscape(t.label) + '</button>';
  }).join('') + '</div>';
}

/**
 * A tree of rooms for a rail group: areas, each with rows. `areas`: [{area, rooms: [{name, tag, attrs}]}];
 * `attrs` are the row's data attributes ({import: 'som-66'} -> data-import="som-66"). Rows are
 * `li.rn-map.vn-map`, which rail.js selects and filters.
 */
function shellRailTreeHtml(areas) {
  var html = '<ul class="rt">';
  (areas || []).forEach(function (grp) {
    html += '<li class="rn-area"><span class="rn-area-label">' + shellEscape(grp.area) + '</span><ul class="rt">';
    grp.rooms.forEach(function (r) {
      var attrs = '';
      Object.keys(r.attrs || {}).forEach(function (k) { attrs += ' data-' + k + '="' + shellEscape(r.attrs[k]) + '"'; });
      html += '<li class="rn-map vn-map"' + attrs + '><span class="rn-label">' + shellEscape(r.name)
        + '</span><span class="rn-vid-tag">' + shellEscape(r.tag) + '</span></li>';
    });
    html += '</ul></li>';
  });
  return html + '</ul>';
}

/**
 * A collapsible panel of the dock: a header (`data-panel="key"`, the click key) and, open, a body.
 * `note` is a small grey note after the title.
 */
function shellPanelHtml(key, title, body, note, open) {
  return '<div class="rg-panel' + (open ? ' open' : '') + '">'
    + '<div class="rg-panel-h" data-panel="' + key + '">'
    + '<span class="rg-panel-caret">' + (open ? '▾' : '▸') + '</span> ' + title
    + (note ? ' <span class="rs-note">' + note + '</span>' : '')
    + '</div>'
    + (open ? '<div class="rg-panel-b">' + body + '</div>' : '')
    + '</div>';
}

/**
 * A grid of swatch cards — a palette to draw with (the Collision tabs' shapes). `cards`: [{attrs, swatch, label,
 * sub, on, dashed, title}]: `attrs` the button's data attributes ({'coll-pick': 3} -> data-coll-pick="3"), `swatch`
 * an svg (shellSwatchSvg), `sub` the small second line, `dashed` the look of a tool that is not one of the entries.
 */
function shellSwatchGridHtml(cards) {
  return '<div class="rg-coll-grid">' + cards.map(function (c) {
    var attrs = '';
    Object.keys(c.attrs || {}).forEach(function (k) { attrs += ' data-' + k + '="' + shellEscape(c.attrs[k]) + '"'; });
    return '<button class="rdf rg-coll-chip' + (c.dashed ? ' rg-coll-pen' : '') + (c.on ? ' on rg-armed' : '') + '"' + attrs
      + ' title="' + shellEscape(c.title || '') + '">' + c.swatch + '<span class="rg-coll-lbl">' + shellEscape(c.label)
      + (c.sub ? '<b>' + shellEscape(c.sub) + '</b>' : '') + '</span></button>';
  }).join('') + '</div>';
}

/** A swatch: a 16×16 square, `path` (in its pixels) filled with `color`, then `extra` svg on top. */
function shellSwatchSvg(path, color, extra) {
  return '<svg class="rg-coll-swatch" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">'
    + '<rect width="16" height="16" class="rg-coll-swatch-bg"/>'
    + (path ? '<path d="' + path + '" fill="' + color + '" fill-opacity=".75"/>' : '') + (extra || '') + '</svg>';
}

/** How the mouse buttons and keys work, as a row of key caps: [[key, what]]. */
function shellKeysHtml(keys) {
  return '<div class="rg-coll-keys">' + keys.map(function (k) { return '<span><kbd>' + shellEscape(k[0]) + '</kbd> ' + shellEscape(k[1]) + '</span>'; }).join('') + '</div>';
}

/** The two buttons that show and hide the rail and the dock, for the name line's actions. */
function shellSidebarTogglesHtml(railOn, dockOn) {
  return '<button class="rdf rg-edit-tool-icon rg-rail-toggle' + (railOn ? ' on' : '') + '" id="rg-rail-toggle-btn"'
    + ' data-edit-act="toggle-rail" aria-pressed="' + railOn + '" title="' + (railOn ? 'Collapse room tree (left sidebar)' : 'Expand room tree (left sidebar)') + '">'
    + '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="6" y1="2" x2="6" y2="14"/></svg></button>'
    + '<button class="rdf rg-edit-tool-icon rg-dock-toggle' + (dockOn ? ' on' : '') + '" id="rg-dock-toggle-btn"'
    + ' data-edit-act="toggle-dock" aria-pressed="' + dockOn + '" title="' + (dockOn ? 'Collapse inspector / tabs (right dock)' : 'Expand inspector / tabs (right dock)') + '">'
    + '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="10" y1="2" x2="10" y2="14"/></svg></button>';
}

/**
 * Put the dock beside the canvas column: the column moves into a row `.rg-edit-row`, the room's name
 * line heads it, a splitter and the dock (`#rg-dock > #rg-panels`) follow. Returns
 * {dock, panels, created}; `created` is false when it was already there.
 */
function shellDockMount(outer) {
  var dock = document.getElementById('rg-dock');
  if (dock) return { dock: dock, panels: document.getElementById('rg-panels'), created: false };
  var row = document.createElement('div');
  row.className = 'rg-edit-row';
  dock = document.createElement('div');
  dock.className = 'rg-dock';
  dock.id = 'rg-dock';
  var panels = document.createElement('div');
  panels.id = 'rg-panels';
  panels.className = 'rg-panels';
  outer.parentNode.insertBefore(row, outer);
  row.appendChild(outer);
  // The room's name line heads the map column, so the dock reaches the top.
  var head = row.parentNode.querySelector(':scope > .rd-head');
  if (head) outer.insertBefore(head, outer.firstChild);
  // The handle that resizes the dock (layout.js).
  row.insertAdjacentHTML('beforeend', '<div class="rg-split" data-split="dock" title="Drag to resize"></div>');
  row.appendChild(dock);
  dock.appendChild(panels);
  return { dock: dock, panels: panels, created: true };
}

/** Take the dock (and its splitter) away again. */
function shellDockUnmount(dock) {
  if (!dock) return;
  var split = dock.parentNode.querySelector('.rg-split');
  if (split) split.parentNode.removeChild(split);
  dock.parentNode.removeChild(dock);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shellEscape: shellEscape, shellFrameHtml: shellFrameHtml, shellRailHtml: shellRailHtml, shellHeadHtml: shellHeadHtml,
    shellCanvasParts: shellCanvasParts, shellToolButtonHtml: shellToolButtonHtml, shellActButtonHtml: shellActButtonHtml,
    shellPillHtml: shellPillHtml, shellSideBarHtml: shellSideBarHtml, shellStatusbarHtml: shellStatusbarHtml, shellTabStripHtml: shellTabStripHtml,
    shellRailTreeHtml: shellRailTreeHtml, shellPanelHtml: shellPanelHtml, shellSidebarTogglesHtml: shellSidebarTogglesHtml,
    shellSwatchGridHtml: shellSwatchGridHtml, shellSwatchSvg: shellSwatchSvg, shellKeysHtml: shellKeysHtml,
    statusPad2: statusPad2, STATUS_NO_XY: STATUS_NO_XY };
}
