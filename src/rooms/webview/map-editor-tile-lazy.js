// Ownership: lazy loading of the Tile tab's family groups — fetching a
// family's sheet as its placeholder nears the view, and putting it in place
// when it arrives.
//
// Split out of map-editor-tiles.js (400-line limit). Every group is drawn at
// its final height before its sheet exists (tileGroupHtml), so neither
// loading nor swapping in moves anything below it.
//
// Owns: _tileObserver.

/**
 * Loads a family's sheet as its placeholder nears the visible part of the
 * list. Rebuilt on every render, because every render replaces the nodes it
 * was watching.
 */
var _tileObserver = null;
/** How far outside the view a group starts loading, in px. */
var TILE_LAZY_MARGIN = 2400; // several screens: loading ahead of the scroll, not at it

/**
 * Put one family's freshly arrived sheet into the list in place.
 *
 * Rebuilding the whole panel for every sheet re-decoded every image in the
 * list and restored the scroll after the fact — "very jumpy when
 * scrolling". The placeholder is already the final height, so swapping just
 * that group moves nothing. False when the group is not on screen.
 */
function tileGroupSwap(family) {
  var body = document.getElementById('rg-tab-body');
  if (!body || _editActiveTab !== 'tile') return false;
  var el = body.querySelector('.rg-tile-group[data-group-fam="' + family + '"]');
  if (!el) return false;
  el.outerHTML = tileGroupHtml(family, el.getBoundingClientRect().width || 360);
  return true;
}

function tileLazyObserve() {
  if (_tileObserver) { _tileObserver.disconnect(); _tileObserver = null; }
  var body = document.getElementById('rg-tab-body');
  if (!body) return;
  var lazy = body.querySelectorAll('[data-lazy-fam]');
  if (!lazy.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    // No observer (an old host): load the first screenful, never all 329.
    for (var i = 0; i < Math.min(lazy.length, 8); i++) ensureFamilySheet(Number(lazy[i].dataset.lazyFam));
    return;
  }
  _tileObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      _tileObserver.unobserve(e.target);
      ensureFamilySheet(Number(e.target.dataset.lazyFam));
    });
  }, { root: typeof panelScroller === 'function' ? panelScroller(body) : body, rootMargin: TILE_LAZY_MARGIN + 'px 0px' });
  for (var j = 0; j < lazy.length; j++) _tileObserver.observe(lazy[j]);
}
