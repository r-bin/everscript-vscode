// Ownership: the Rooms tab's two resizable columns — the rooms rail on the
// left and the editor's dock on the right — dragged by their handles
// (`[data-split="rail"]`, render-radar.js; `[data-split="dock"]`,
// map-editor-ui.js editDock). Widths are CSS variables on the page root
// (`--rm-rail-w`, `--rg-dock-w`), so they survive every re-render, and are
// remembered by the host (`uiPrefs`, key `layoutWidths`).
//
// Owns: _layoutWidths, _layoutDrag.

var LAYOUT_MIN = { rail: 160, dock: 300 };
// The map column never gets narrower than this while the dock grows.
var LAYOUT_MAP_MIN = 360;
var _layoutWidths = { rail: null, dock: null };
var _layoutDrag = null;

function layoutApply() {
  var root = document.documentElement;
  if (!root || !root.style) return;
  if (_layoutWidths.rail) root.style.setProperty('--rm-rail-w', _layoutWidths.rail + 'px');
  if (_layoutWidths.dock) root.style.setProperty('--rg-dock-w', _layoutWidths.dock + 'px');
}

/** The host's remembered widths (map-editor-panels.js applyUiPrefs). */
function layoutApplyPrefs(saved) {
  if (!saved || typeof saved !== 'object') return;
  ['rail', 'dock'].forEach(function (k) {
    var n = Number(saved[k]);
    if (isFinite(n) && n >= LAYOUT_MIN[k]) _layoutWidths[k] = Math.round(n);
  });
  layoutApply();
}

/** Width for the column `which` with the pointer at `x`, clamped. */
function layoutWidthAt(which, x) {
  if (which === 'rail') {
    var rail = document.querySelector('.rm-rail');
    if (!rail) return null;
    var max = Math.max(LAYOUT_MIN.rail, window.innerWidth - LAYOUT_MAP_MIN);
    return Math.min(max, Math.max(LAYOUT_MIN.rail, Math.round(x - rail.getBoundingClientRect().left)));
  }
  var dock = document.getElementById('rg-dock');
  var row = dock && dock.parentNode;
  if (!dock || !row) return null;
  var r = row.getBoundingClientRect();
  var w = Math.round(dock.getBoundingClientRect().right - x);
  return Math.min(Math.max(LAYOUT_MIN.dock, r.width - LAYOUT_MAP_MIN), Math.max(LAYOUT_MIN.dock, w));
}

function setupLayoutResize() {
  if (typeof document === 'undefined' || !document.addEventListener || document._rgLayoutResize) return;
  document._rgLayoutResize = true;
  document.addEventListener('pointerdown', function (e) {
    var h = e.target && e.target.closest ? e.target.closest('[data-split]') : null;
    if (!h || e.button !== 0) return;
    _layoutDrag = h.getAttribute('data-split');
    document.body.classList.add('rg-resizing');
    e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    if (!_layoutDrag) return;
    var w = layoutWidthAt(_layoutDrag, e.clientX);
    if (w == null) return;
    _layoutWidths[_layoutDrag] = w;
    layoutApply();
  });
  document.addEventListener('pointerup', function () {
    if (!_layoutDrag) return;
    _layoutDrag = null;
    document.body.classList.remove('rg-resizing');
    if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: 'layoutWidths', value: _layoutWidths });
  });
}

setupLayoutResize();
