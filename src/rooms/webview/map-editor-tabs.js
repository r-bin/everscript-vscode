// Ownership: which of the editor's five tabs is showing, and the tab strip
// that switches between them.
//
// The content each tab gates lives elsewhere — map-editor-panels.js owns
// the families/tiles/needed/compose panels (Tile tab) and the budget +
// checks panels (Info tab); map-editor-trigger-panel.js the Trigger tab
// (its scripts map-editor-trigger-scripts.js); map-editor-deco.js owns the Widgets tab
// (widgetsTabHtml). This file only decides which group is on screen; it
// renders nothing of its own beyond the strip itself.
//
// Clicking a tab needs no listener of its own: `data-edit-active-tab` is
// just another key in map-editor-input.js's EDIT_CLICK_KEYS, so the same
// delegated, bind-once handler that already drives every other control in
// the dock (see the webview-dom-safety skill) covers it too.
//
// Tile, Collision and Animation are one top tab, `Tile`, with those three as
// sub-tabs: each is still its own `_editActiveTab` value, so everything that
// asks which tab is open keeps working; the strip only files them together.
//
// Owns: _editActiveTab, _editTileSub.

var _editActiveTab = 'tile';
/** The Tile tab's sub-tab last open, which its top tab goes back to. */
var _editTileSub = 'tile';

/** The Tile tab's sub-tabs. */
var EDIT_TILE_SUBTABS = [
  ['tile', 'Tile', 'Pick and paint tiles'],
  ['collision', 'Collision', 'Collision shapes, drawn by hand over the estimate'],
  ['anim', 'Animation', 'Animated tiles: frames, patterns, timing'],
];

function editInTileGroup(tab) {
  return EDIT_TILE_SUBTABS.some(function (t) { return t[0] === tab; });
}

/**
 * Tab order is the design mock's own (`tabDefs`, `Map Editor UI.dc.html`):
 * Tile, Special, Trigger, **Widgets, Info** — Info last, because it is the
 * read-only one. Phase 5 shipped Widgets last by mistake and Phase 7a
 * corrected it (docs/map-editor-redesign-plan.md §7a).
 *
 * Content lives with each tab's owner: Special is map-editor-special.js's
 * specialTabHtml, Widgets is map-editor-deco.js's widgetsTabHtml, the rest
 * are map-editor-panels.js.
 */
var EDIT_TABS = [
  ['tile', 'Tile'],
  ['special', 'Special'],
  ['trigger', 'Trigger'],
  ['object', 'Object'],
  ['widgets', 'Widgets'],
  ['info', 'Info'],
];

/** The horizontal strip at the top of the docked panel column. */
function buildEditTabStripHtml() {
  var html = '<div class="rg-tabstrip" id="rg-tabstrip">';
  if (editInTileGroup(_editActiveTab)) _editTileSub = _editActiveTab;
  EDIT_TABS.forEach(function (t) {
    // `Tile` opens the sub-tab last open in it.
    var on = t[0] === 'tile' ? editInTileGroup(_editActiveTab) : _editActiveTab === t[0];
    html += '<button class="rg-tab' + (on ? ' on' : '') + '" data-edit-active-tab="'
      + (t[0] === 'tile' ? _editTileSub : t[0]) + '">' + t[1] + '</button>';
  });
  return html + '</div>';
}

/** Tile | Collision | Animation, over the Tile tab's body; '' on the other tabs. */
function editTileSubtabsHtml() {
  if (!editInTileGroup(_editActiveTab)) return '';
  return '<div class="rg-subtabs rg-tile-subtabs" role="tablist">' + EDIT_TILE_SUBTABS.map(function (t) {
    var on = _editActiveTab === t[0];
    return '<button class="rg-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-edit-active-tab="' + t[0]
      + '" title="' + escH(t[2]) + '">' + t[1] + '</button>';
  }).join('') + '</div>';
}
