// Ownership: which of the editor's five tabs is showing, and the tab strip
// that switches between them.
//
// The content each tab gates lives elsewhere — map-editor-panels.js owns
// the families/tiles/needed/compose panels (Tile tab) and the budget +
// checks panels (Info tab); tables-builder.js owns the entity tables
// mirrored into the Trigger tab; map-editor-deco.js owns the Widgets tab
// (widgetsTabHtml). This file only decides which group is on screen; it
// renders nothing of its own beyond the strip itself.
//
// Clicking a tab needs no listener of its own: `data-edit-active-tab` is
// just another key in map-editor-input.js's EDIT_CLICK_KEYS, so the same
// delegated, bind-once handler that already drives every other control in
// the dock (see the webview-dom-safety skill) covers it too.
//
// Owns: _editActiveTab.

var _editActiveTab = 'tile';

/**
 * Special slots between Tile and Trigger, per the design mock's own tab
 * order; its content is map-editor-special.js's specialTabHtml. Widgets is
 * last, also per the mock's own screen order — its content is
 * map-editor-deco.js's widgetsTabHtml (Phase 5,
 * docs/map-editor-redesign-plan.md).
 */
var EDIT_TABS = [
  ['tile', 'Tile'],
  ['special', 'Special'],
  ['trigger', 'Trigger'],
  ['info', 'Info'],
  ['widgets', 'Widgets'],
];

/** The horizontal strip at the top of the docked panel column. */
function buildEditTabStripHtml() {
  var html = '<div class="rg-tabstrip" id="rg-tabstrip">';
  EDIT_TABS.forEach(function (t) {
    html += '<button class="rg-tab' + (_editActiveTab === t[0] ? ' on' : '') + '" data-edit-active-tab="'
      + t[0] + '">' + t[1] + '</button>';
  });
  return html + '</div>';
}
