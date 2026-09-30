// Ownership: the floating tool pill above the canvas card — which tools
// exist, their icons, and the overflow menu.
//
// Split out of map-editor-ui.js in Phase 7a
// (docs/map-editor-redesign-plan.md §7a), which still owns the docked
// sidebar, the composer and the construct library. The pill's verbs are
// map-editor-actions.js (`editAction`); the clicks reach them through
// map-editor-input.js's one delegated handler, so nothing here binds a
// listener of its own.
//
// Tooltips are `data-tip` (map-editor-canvas.css), not `title`: the native
// tooltip never showed on the pill, which hangs over the card's top edge.
//
// Owns no state — the pill renders `editDraft()`.

var EDIT_TOOLS = [
  ['select', 'select', 'Click a trigger to select it; drag its own cells to move it. '
    + 'Backspace/Delete removes it, Cmd/Ctrl+C/V copies and pastes it'],
  ['paint', 'pencil', 'Draw what the open tab has selected: a tile (Tile), a special (Special), '
    + 'a trigger — drag out its box (Trigger), a widget (Widgets)'],
  ['erase', 'erase', 'Erase what the open tab draws. Tile: the cuttable tile with Cuttable on; '
    + 'the front art with Foreground; the ground with Background; with both, the front art first, '
    + 'then the tile itself. Special: the special. Trigger: the trigger under the cursor'],
  ['pick', 'pick', 'Click the map to pick up what is there — the Boy, a special, a trigger or the tile — '
    + 'with the tab, the tool and the level that draw it'],
  ['copy', 'copy', 'Drag to select a region, Cmd/Ctrl+C to copy it, Cmd/Ctrl+V to paste it as one object — '
    + 'drag it where it goes while it is selected'],
  ['move', 'move', 'Drag to take a region, then click to move it; the source is backfilled with the selected tile'],
  ['stamp', 'stamp', 'Click to place the selected construct, with its triggers and objects'],
];

/**
 * The `room`/`deco` phase pair that used to live here (through v0.58.1) is
 * gone as of §8a.2 (docs/map-editor-redesign-plan.md): "the side panel
 * selection should dictate if it is being drawn in the fg/bg." Both of what
 * the toggle decided are now read directly off the brush and the cell in
 * `editResolve` (map-editor-phases.js) — see that file's header for the
 * derivation. There is no replacement control here: layer targeting is the
 * Tile tab's own `auto|front|ground` segmented row (map-editor-tiles.js's
 * `_layerForce`), not a second thing the pill needs to offer.
 */

/** The pill's groups, in order, separated by a thin divider each. */
var EDIT_TOOL_GROUPS = [
  ['select', 'paint', 'erase', 'pick'],
  ['copy', 'move', 'stamp'],
];

/**
 * One glyph per tool, since the pill is icon-only.
 *
 * The mock's own pill also shows `S`/`B` (start a step / B trigger draft) and
 * `◆` (paint a collision override directly). **This codebase has no such
 * tools** — there is no trigger-drawing draft and no collision brush — so no
 * button is rendered for them. A dead control is worse than an honest gap;
 * see §7a of the plan, where the gap is recorded.
 */
var EDIT_TOOL_ICONS = {
  select: '↖', paint: '✎', erase: '⌫', pick: '⤵',
  copy: '⧉', move: '✥', stamp: '❖',
};

/**
 * The actions that did not earn a permanent slot.
 *
 * `new room` **stays here** — Phase 7a expected §7b to move it to the rail's
 * `+ New Map` footer, but checking the two turned up two different actions,
 * not one. This one opens an inline w/h form and drafts a blank room
 * borrowing *the room currently open in the editor*: an in-editor tool, only
 * meaningful once a room is rendered. The rail's `+ New Map` is the
 * project-level entry point — the same thing the `everscript.newMap` command
 * runs (`roomsNewMap()`, map-editor-newroom.js): a fixed 24×16 grid borrowing
 * Strong Heart's Hut, usable with nothing open at all. Collapsing them into
 * one control would have lost the size form or lost the no-room-open entry
 * point, so both stay, in the place each belongs.
 */
var EDIT_OVERFLOW_ACTS = [
  ['clear', 'Discard draft', 'Discard every change in this draft'],
  ['copy-map', 'Copy map', 'Duplicate this room as a new custom map'],
  ['save-widget', 'Save as widget', 'Save the current selection or stamped object as a widget in the library'],
  ['export', 'Copy draft as JSON', 'Copy the draft as JSON for the encoder'],
  ['export-rom', 'Export ROM…', 'Build a playable ROM: this custom map in Brian’s room (0x15), entered straight from the intro'],
  ['play-rom', 'Play in emulator', 'Build the same ROM and run it in the embedded emulator — no file is written'],
  ['new-room', 'New room…', 'Start a blank room to try things in, borrowing this room’s graphics'],
  ['export-map', 'Export map…', 'Save this custom map as a .zip: the room blob, the editor file, a sample .evs and its stamps'],
  ['delete-map', 'Delete map…', 'Delete this custom map and its whole edit history (asks first)'],
];

function editToolButtonHtml(key) {
  var def = null;
  EDIT_TOOLS.forEach(function (t) { if (t[0] === key) def = t; });
  if (!def) return '';
  var d = editDraft();
  // Erase used to be dimmed outside `deco` phase; §8a.2 dropped the phase,
  // and editResolve's own erase branch is already a no-op on a bare cell, so
  // there is nothing left to gate the button on.
  // The pencil says what it draws: a badge, and the tooltip's first line.
  var tip = def[2];
  var badge = '';
  if (key === 'paint' && typeof editDrawable === 'function') {
    tip = 'Pencil — draws ' + editDrawable().label + '\n' + def[2];
    badge = editDrawBadgeHtml(false);
  } else if (key === 'erase' && typeof editEraseTarget === 'function') {
    tip = 'Eraser — takes off ' + editEraseTarget().label + '\n' + def[2];
    badge = editDrawBadgeHtml(true);
  }
  return '<button class="rdf rg-edit-tool-icon' + (d && d.tool === key ? ' on' : '')
    + '" data-edit-tool="' + key + '" data-tip="' + escH(tip) + '" aria-label="' + escH(def[1]) + '">'
    + '<span class="rg-edit-icon" aria-hidden="true">' + EDIT_TOOL_ICONS[key] + '</span>' + badge + '</button>';
}

/**
 * The pill, plus the new-room form, inside one wrapper.
 *
 * The wrapper exists because the pill is absolutely positioned over the
 * canvas card's top edge while the form is a normal flow row — and
 * `renderEditChrome` replaces the whole thing in one `outerHTML` write, so
 * they have to share one node or the form leaks a second copy on every
 * redraw (which is what the stale-`#rg-newroom` sweep used to clean up).
 */
function buildEditToolbarHtml() {
  var html = '<div class="rg-edit-chrome" id="rg-edit-chrome">'
    + '<div class="rd-filters rg-edit-bar" id="rg-edit-bar">';
  EDIT_TOOL_GROUPS.forEach(function (group, i) {
    if (i) html += '<span class="rg-edit-divider"></span>';
    html += '<span class="rg-edit-group">';
    group.forEach(function (key) { html += editToolButtonHtml(key); });
    if (i === 1) {
      var hasSel = (typeof widgetHasSelection === 'function') ? widgetHasSelection() : !!_editSel;
      if (hasSel) {
        html += '<button class="rdf rg-edit-tool-icon" data-edit-act="save-widget" data-tip="Save selection as a widget in library" aria-label="save widget"><span class="rg-edit-icon" aria-hidden="true">⬚</span></button>';
      }
    }
    html += '</span>';
  });
  // The room/deco phase pair that used to sit here is gone — §8a.2.
  html += '<span class="rg-edit-divider"></span><span class="rg-edit-group">'
    + '<button class="rdf rg-edit-tool-icon" data-edit-act="undo" data-tip="Undo the last change"'
    + ' aria-label="undo"><span class="rg-edit-icon" aria-hidden="true">↶</span></button>'
    + '<button class="rdf rg-edit-tool-icon" data-edit-act="redo" data-tip="Redo"'
    + ' aria-label="redo"><span class="rg-edit-icon" aria-hidden="true">↷</span></button>'
    + '</span><span class="rg-edit-divider"></span>'
    + buildEditOverflowHtml()
    + '</div>' + buildNewRoomHtml()
    // The level bar sits at the card's left edge (map-editor-levels.js).
    + (typeof buildLevelBarHtml === 'function' ? buildLevelBarHtml() : '') + '</div>';
  return html;
}

/**
 * The `⋯` menu. Same three classes and the same single
 * close-on-outside-click list (`EDIT_FILTER_MENUS`, map-editor-input.js) as
 * the filter bar's dropdowns — opening downward instead of up, since this
 * one hangs off the top of the card rather than the bottom.
 */
function buildEditOverflowHtml() {
  var items = EDIT_OVERFLOW_ACTS.map(function (a) {
    return '<button class="rdf" data-edit-act="' + a[0] + '" title="' + escH(a[2]) + '">'
      + escH(a[1]) + '</button>';
  }).join('');
  return '<span class="rg-filter-group">'
    + '<button class="rdf rg-edit-tool-icon rg-filter-caret" data-edit-tool-menu="1"'
    + ' data-tip="More: export or play a ROM, copy the draft, discard it, or start a blank room" aria-label="more actions">'
    + '<span class="rg-edit-icon" aria-hidden="true">⋯</span></button>'
    + '<div class="rg-filter-popup rg-filter-popup-down" id="rg-tool-dropdown" hidden>'
    + items + '</div></span>';
}
