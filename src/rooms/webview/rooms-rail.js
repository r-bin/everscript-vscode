// Ownership: the Rooms tab's left rail — every interaction in it.
//
// Phase 7b split this out of tab-init.js, which now owns only the top-level
// tab strip. The rail's five behaviours all read or write the same tree, so
// one file owns them: group collapse, area collapse, the search filter, which
// row is selected, and the `+ New Map` footer.
//
// Owns: _railQuery, _railExitBound.
//
// There is no `_vanillaMode` any more. The mode toggle swapped two trees in
// and out; the rail now shows both at once as two collapsible groups, so
// "which tree am I looking at" is not state — it is where you are scrolled.
// A row says which tree it came from itself: `data-vid` is a ROM catalogue
// room, `data-map` is a room declared in the active .evs file.

/** The active search term, lowercased. '' means no filter. */
var _railQuery = '';

/** Set once the document-level exit-link handler is attached. */
var _railExitBound = false;

/** Closest ancestor (inclusive) matching a selector, or null. */
function railClosest(el, sel) {
  return (el && el.closest) ? el.closest(sel) : null;
}

function railScrollEl() { return document.getElementById('rm-rail-scroll'); }

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
  document.querySelectorAll('.rn-map.rsel').forEach(function (x) { x.classList.remove('rsel'); });
  li.classList.add('rsel');
  if (li.dataset.vid !== undefined) {
    var vr = (typeof VANILLA_ROOM_DETAILS !== 'undefined' && VANILLA_ROOM_DETAILS)
      ? VANILLA_ROOM_DETAILS[li.dataset.vid] : null;
    if (vr) renderRoomDetail(vr);
    return;
  }
  var room = (typeof ROOMS !== 'undefined' && ROOMS) ? ROOMS[li.dataset.map] : null;
  if (room) renderRoomDetail(room);
}

// ── Groups ───────────────────────────────────────────────────────────────────

/** Open or close one top-level group. `open` omitted means toggle. */
function railSetGroup(key, open) {
  var head = document.querySelector('.rm-grp-h[data-rail-grp="' + key + '"]');
  var body = document.getElementById('rm-' + key + '-tree');
  if (!head || !body) return;
  var next = (open === undefined) ? body.hidden : !!open;
  body.hidden = !next;
  head.setAttribute('aria-expanded', next ? 'true' : 'false');
  var chev = head.querySelector('.rm-grp-chev');
  if (chev) chev.textContent = next ? '▾' : '▸';
}

// ── Search ───────────────────────────────────────────────────────────────────
// A client-side filter over the already-rendered rows: no host round-trip, no
// re-render, and no second copy of the room list to keep in sync. Matching is
// on the row's own text plus its id attribute, so both "sewers" and "0x12"
// find Ebon Keep sewers.
//
// Expansion state is never written while filtering. `.rm-searching` on the
// scroll box force-reveals collapsed groups and areas through CSS for the
// duration, so clearing the field restores exactly the tree that was open.

/** What a row matches against: its visible label plus its id. */
function railRowHaystack(li) {
  return ((li.textContent || '') + ' ' + (li.dataset.vid || '') + ' ' + (li.dataset.map || ''))
    .toLowerCase();
}

/** Apply `_railQuery` to the tree. Cheap enough to run on every keystroke. */
function railApplyFilter() {
  var scroll = railScrollEl();
  if (!scroll) return;
  var q = _railQuery;
  var searching = q.length > 0;
  scroll.classList.toggle('rm-searching', searching);

  var hits = 0;
  scroll.querySelectorAll('li.rn-map').forEach(function (li) {
    var show = !searching || railRowHaystack(li).indexOf(q) !== -1;
    li.classList.toggle('rm-off', !show);
    if (show) hits += 1;
  });
  // An area with nothing left in it is noise, and so is a whole group.
  scroll.querySelectorAll('li.rn-area').forEach(function (area) {
    area.classList.toggle('rm-off',
      searching && !area.querySelector('li.rn-map:not(.rm-off)'));
  });
  scroll.querySelectorAll('.rm-grp').forEach(function (grp) {
    grp.classList.toggle('rm-off',
      searching && !grp.querySelector('li.rn-map:not(.rm-off)'));
  });

  var none = document.getElementById('rm-rail-none');
  if (none) none.hidden = !searching || hits > 0;
}

/** Drop the filter and put the field back to empty. */
function railClearSearch() {
  var input = document.getElementById('rm-rail-q');
  if (input) input.value = '';
  if (!_railQuery) return;
  _railQuery = '';
  railApplyFilter();
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
  var scroll = railScrollEl();
  if (scroll && !scroll.dataset.railBound) {
    scroll.dataset.railBound = '1';
    scroll.addEventListener('click', function (e) {
      var t = e.target;
      var head = railClosest(t, '.rm-grp-h');
      if (head) { railSetGroup(head.dataset.railGrp); return; }
      var label = railClosest(t, '.rn-area-label');
      if (label) {
        var li = railClosest(label, 'li.rn-area');
        if (li) li.classList.toggle('collapsed');
        return;
      }
      var row = railClosest(t, 'li.rn-map');
      if (row) railSelectRow(row);
    });
  }

  var input = document.getElementById('rm-rail-q');
  if (input && !input.dataset.railBound) {
    input.dataset.railBound = '1';
    input.addEventListener('input', function () {
      _railQuery = String(input.value || '').trim().toLowerCase();
      railApplyFilter();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { railClearSearch(); input.blur(); }
    });
  }

  // `+ New Map` is the project-level action — the same one the
  // `everscript.newMap` command runs, which is why it can share
  // `roomsNewMap()` rather than post a message the host would only bounce
  // back. The editor's own `new room…` (an inline w/h form that borrows the
  // *currently open* room's graphics) is a different action and stays in the
  // tool pill's `⋯` overflow.
  var newBtn = document.getElementById('rm-new-map');
  if (newBtn && !newBtn.dataset.railBound) {
    newBtn.dataset.railBound = '1';
    newBtn.addEventListener('click', function () {
      if (typeof roomsNewMap === 'function') roomsNewMap();
    });
  }

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
