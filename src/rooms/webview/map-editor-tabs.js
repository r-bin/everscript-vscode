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
// Owns: _editActiveTab.

var _editActiveTab = 'tile';

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
  ['collision', 'Collision'],
  ['special', 'Special'],
  ['trigger', 'Trigger'],
  ['object', 'Object'],
  ['widgets', 'Widgets'],
  ['info', 'Info'],
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
