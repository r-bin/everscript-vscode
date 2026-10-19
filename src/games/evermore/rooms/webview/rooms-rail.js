// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Rooms tab's left rail — what selecting a row does, following an exit link, and wiring
// the rail to the shared shell. The rail's own behaviour (group and area collapse, the search filter, the
// click binding) is the shell's: src/core/map-editor/shell/rail.js, shared with the Secret of
// Mana editor; its markup is shellRailHtml (tree-renderer.js buildRoomRailHtml).
//
// A row says which tree it came from itself: `data-vid` is a ROM catalogue room, `data-map` is a room
// declared in the active .evs file, `data-import` a converted one, `data-custom` a custom map.

var _railExitBound = false;

/** What the Rooms tab's search also matches on a row: its ids (so "0x12" finds a room) and "custom". */
function railExtraHaystack(li) {
  return (li.dataset.vid || '') + ' ' + (li.dataset.import || '') + ' ' + (li.dataset.map || '')
    + ' ' + (li.dataset.custom ? 'custom' : '');
}

// ── Selection ────────────────────────────────────────────────────────────────
// One handler for both trees. Pre-7b the live and vanilla handlers each
// cleared their own `.rsel` only, so a live selection and a vanilla one could
// both be highlighted at once; `.vn-map` also carries `.rn-map`, so one
// selector clears either.

/**
 * Select a room row and render its detail panel.
 * @param {Element} li  An `li.rn-map`, from either tree.
 */
function railSelectRow(li) {
  if (!li) return;
  if (typeof isCompactMode === 'function' && isCompactMode()) {
    if (typeof _layoutCollapsed !== 'undefined') {
      _layoutCollapsed.rail = true;
      _layoutCollapsed.dock = true;
      if (typeof layoutApplyCollapsed === 'function') layoutApplyCollapsed();
    }
  }
  // A custom map (map-editor-custom.js) selects itself.
  if (li.dataset.custom !== undefined) { customOpen(li.dataset.custom); return; }
  document.querySelectorAll('.rn-map.rsel').forEach(function (x) { x.classList.remove('rsel'); });
  li.classList.add('rsel');
  // A converted room (rooms-imported.js) asks the host for its details first.
  if (li.dataset.import !== undefined) { importedOpen(li); return; }
  if (li.dataset.vid !== undefined) {
    var vr = (typeof VANILLA_ROOM_DETAILS !== 'undefined' && VANILLA_ROOM_DETAILS)
      ? VANILLA_ROOM_DETAILS[li.dataset.vid] : null;
    if (vr) renderRoomDetail(vr);
    return;
  }
  var room = (typeof ROOMS !== 'undefined' && ROOMS) ? ROOMS[li.dataset.map] : null;
  if (room) renderRoomDetail(room);
}

// ── Following an exit ────────────────────────────────────────────────────────
// A script's CHANGE MAP destination is rendered as a link. Clicking it opens
// that room, which turns the trigger tables into something you can walk
// through the game with.
//
// The navigation reuses the rail's own handler rather than duplicating it:
// clear whatever is hiding the row, then click it. That way the selection
// highlight and the detail render stay owned by one place. Pre-7b this
// pressed the `Vanilla` mode button first; with one combined list the
// equivalent is opening the Vanilla group and the room's own area.

/** Open the vanilla room with this id. Returns false if it is not listed. */
function gotoVanillaRoom(mapId) {
  var found = null;
  document.querySelectorAll('.vn-map').forEach(function (li) {
    if (!found && parseInt(li.dataset.vid, 16) === mapId) found = li;
  });
  if (!found) return false;
  railClearSearch();
  railSetGroup('vanilla', true);
  var area = railClosest(found, 'li.rn-area');
  if (area) area.classList.remove('collapsed');
  found.click();
  if (found.scrollIntoView) found.scrollIntoView({ block: 'nearest' });
  return true;
}

// ── Wiring ───────────────────────────────────────────────────────────────────
// One delegated click listener on the scroll box, guarded by a dataset flag:
// the rail node outlives any re-render of its contents, so a second bind
// would stack a second handler and every group toggle would cancel itself
// out (webview-dom-safety §1). `e.target` is the deepest node under the
// pointer — a chevron span, a label span — so every branch walks up to the
// element that actually carries the meaning (§2).

function setupRoomRail() {
  // `+ New Map` is the project-level action — the same one the `everscript.newMap` command runs, which is
  // why it can share `roomsNewMap()` rather than post a message the host would only bounce back. The
  // editor's own `new room…` (an inline w/h form that borrows the *currently open* room's graphics) is a
  // different action and stays in the tool pill's `⋯` overflow.
  shellRailBind({
    onSelect: railSelectRow,
    onNew: function () { if (typeof roomsNewMap === 'function') roomsNewMap(); },
  });

  // Delegated on the document, because the detail panel is re-rendered on
  // every room change and per-link handlers would have to be rewired.
  if (!_railExitBound) {
    _railExitBound = true;
    document.addEventListener('click', function (e) {
      var el = railClosest(e.target, '[data-goto-map]');
      if (!el) return;
      if (e.preventDefault) e.preventDefault();
      e.stopPropagation();
      gotoVanillaRoom(parseInt(el.dataset.gotoMap, 16));
    });
  }
}

setupRoomRail();
