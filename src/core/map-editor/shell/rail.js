// Ownership: the left rail's own behaviour — open and close a group, collapse an area, the search
// filter over the rows, and binding the clicks. Game-neutral: the Evermore Rooms tab and the Secret of
// Mana editor both bind their rail through shellRailBind and say what selecting a row does. The rail's
// markup is shellRailHtml (frame.js); its look is shell-rail.css. Plain browser script: globals.
//
// Owns: _railQuery.
//
// Search is a client-side filter over the already-rendered rows: no host round-trip, no re-render, and
// no second copy of the list to keep in sync. Matching is on the row's own text plus its id attributes.
// Expansion state is never written while filtering: `.rm-searching` on the scroll box force-reveals
// collapsed groups and areas through CSS for the duration, so clearing the field restores exactly the
// tree that was open.

/** The active search term, lowercased. '' means no filter. */
var _railQuery = '';

/** Closest ancestor (inclusive) matching a selector, or null. */
function railClosest(el, sel) {
  return (el && el.closest) ? el.closest(sel) : null;
}

function railScrollEl() { return document.getElementById('rm-rail-scroll'); }

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

/**
 * What a row matches against: its visible label plus its data attributes. A page may add words
 * through `railExtraHaystack(li)` (the Rooms tab adds its id attributes and "custom").
 */
function railRowHaystack(li) {
  var extra = (typeof railExtraHaystack === 'function') ? railExtraHaystack(li) : '';
  return ((li.textContent || '') + ' ' + extra).toLowerCase();
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

/**
 * Bind the rail: one delegated click listener on the scroll box, guarded by a dataset flag (the rail
 * node outlives any re-render of its contents, so a second bind would stack a second handler and every
 * group toggle would cancel itself out — webview-dom-safety §1), the search field, and the footer
 * button. `e.target` is the deepest node under the pointer, so every branch walks up to the element
 * that carries the meaning (§2).
 *
 *   o.onSelect(li)  a row (`li.rn-map`) was clicked
 *   o.onNew()       the footer button (`#rm-new-map`) was clicked
 */
function shellRailBind(o) {
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
      if (row && o.onSelect) o.onSelect(row);
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

  var newBtn = document.getElementById('rm-new-map');
  if (newBtn && !newBtn.dataset.railBound) {
    newBtn.dataset.railBound = '1';
    newBtn.addEventListener('click', function () { if (o.onNew) o.onNew(); });
  }
}
