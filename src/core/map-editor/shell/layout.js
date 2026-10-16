// Ownership: the editor page's two resizable columns — the rail on the left and the dock on the
// right — dragged by their handles (`[data-split="rail"]`, shellFrameHtml; `[data-split="dock"]`,
// shellDockMount), their collapsed states and the compact (narrow window) overlay mode. Widths are
// CSS variables on the page root (`--rm-rail-w`, `--rg-dock-w`), so they survive every re-render,
// and are remembered through `shellSavePref` (the Rooms tab: the host's `uiPrefs`).
// Game-neutral: loaded by the Evermore Rooms tab and the Secret of Mana editor. Plain script: globals.
//
// Owns: _layoutWidths, _layoutDrag, _layoutCollapsed, shellPrefSaver.

/**
 * Where a preference goes. A page sets `shellPrefSaver = function (key, value) {...}`; the Rooms tab
 * leaves it and gets the host's `saveUiPref` message through `vs`.
 */
var shellPrefSaver = null;
function shellSavePref(key, value) {
  if (shellPrefSaver) { shellPrefSaver(key, value); return; }
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: key, value: value });
}

var LAYOUT_MIN = { rail: 160, dock: 300 };
// The map column never gets narrower than this while the dock grows.
var LAYOUT_MAP_MIN = 360;
var LAYOUT_COMPACT_WIDTH = 1050;
var _layoutWidths = { rail: null, dock: null };
var _layoutCollapsed = { rail: false, dock: false };
var _layoutDrag = null;

function isRailVisible() {
  return !_layoutCollapsed.rail;
}

function isDockVisible() {
  return !_layoutCollapsed.dock;
}

function isCompactMode() {
  var panels = document.querySelector('.rm-panels');
  var w = panels ? panels.getBoundingClientRect().width : (typeof window !== 'undefined' ? window.innerWidth : 1200);
  return w > 0 && w < LAYOUT_COMPACT_WIDTH;
}

function closeOverlays() {
  var changed = false;
  if (!_layoutCollapsed.rail) { _layoutCollapsed.rail = true; changed = true; }
  if (!_layoutCollapsed.dock) { _layoutCollapsed.dock = true; changed = true; }
  if (changed) {
    layoutApplyCollapsed();
    shellSavePref('layoutCollapsed', _layoutCollapsed);
  }
}

function layoutApplyBackdrop() {
  var panels = document.querySelector('.rm-panels');
  if (!panels) return;
  var bd = document.getElementById('rg-overlay-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'rg-overlay-backdrop';
    bd.className = 'rg-overlay-backdrop';
    bd.title = 'Click to close';
    bd.addEventListener('click', function () {
      closeOverlays();
    });
    panels.appendChild(bd);
  }
  var show = isCompactMode() && (!_layoutCollapsed.rail || !_layoutCollapsed.dock);
  bd.classList.toggle('active', show);
}

function layoutUpdateCompact() {
  var compact = isCompactMode();
  var panels = document.querySelector('.rm-panels');
  var roomDetail = document.getElementById('room-detail');
  var body = document.body;

  if (panels) panels.classList.toggle('rm-compact', compact);
  if (roomDetail) roomDetail.classList.toggle('rg-compact', compact);
  if (body) body.classList.toggle('rm-compact-mode', compact);

  if (compact) {
    // If transitioning into compact mode and both sidebars were open,
    // collapse the rail so at most one overlay is active and map is clear
    if (!_layoutCollapsed.rail && !_layoutCollapsed.dock) {
      _layoutCollapsed.rail = true;
      layoutApplyCollapsed();
    }
  }

  layoutApplyBackdrop();
  if (typeof _zoomRefit === 'function') _zoomRefit();
}

function layoutApplyCollapsed() {
  var panels = document.querySelector('.rm-panels');
  var rail = document.querySelector('.rm-rail');
  var railSplit = document.querySelector('.rm-split[data-split="rail"]');
  var dock = document.getElementById('rg-dock');
  var dockSplit = document.querySelector('.rg-split[data-split="dock"]');
  var roomDetail = document.getElementById('room-detail');

  if (panels) {
    if (_layoutCollapsed.rail) panels.classList.add('rail-collapsed');
    else panels.classList.remove('rail-collapsed');
  }
  if (rail) {
    if (_layoutCollapsed.rail) rail.classList.add('collapsed');
    else rail.classList.remove('collapsed');
  }
  if (railSplit) {
    if (_layoutCollapsed.rail) railSplit.classList.add('collapsed');
    else railSplit.classList.remove('collapsed');
  }
  if (roomDetail) {
    if (_layoutCollapsed.dock) roomDetail.classList.add('dock-collapsed');
    else roomDetail.classList.remove('dock-collapsed');
  }
  if (dock) {
    if (_layoutCollapsed.dock) dock.classList.add('collapsed');
    else dock.classList.remove('collapsed');
  }
  if (dockSplit) {
    if (_layoutCollapsed.dock) dockSplit.classList.add('collapsed');
    else dockSplit.classList.remove('collapsed');
  }

  layoutApplyBackdrop();
  if (typeof renderEditHeadActs === 'function') renderEditHeadActs();
  if (typeof _zoomRefit === 'function') _zoomRefit();
}

function editToggleRail() {
  _layoutCollapsed.rail = !_layoutCollapsed.rail;
  if (isCompactMode() && !_layoutCollapsed.rail) {
    // Only one sidebar overlay open at a time in compact mode
    _layoutCollapsed.dock = true;
  }
  layoutApplyCollapsed();
  shellSavePref('layoutCollapsed', _layoutCollapsed);
}

function editToggleDock() {
  _layoutCollapsed.dock = !_layoutCollapsed.dock;
  if (isCompactMode() && !_layoutCollapsed.dock) {
    // Only one sidebar overlay open at a time in compact mode
    _layoutCollapsed.rail = true;
  }
  layoutApplyCollapsed();
  shellSavePref('layoutCollapsed', _layoutCollapsed);
}

function collapseSidebarsForEmulator() {
  _layoutCollapsed.rail = true;
  _layoutCollapsed.dock = true;
  layoutApplyCollapsed();
}

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
  if (saved.layoutCollapsed && typeof saved.layoutCollapsed === 'object') {
    if (typeof saved.layoutCollapsed.rail === 'boolean') _layoutCollapsed.rail = saved.layoutCollapsed.rail;
    if (typeof saved.layoutCollapsed.dock === 'boolean') _layoutCollapsed.dock = saved.layoutCollapsed.dock;
    layoutApplyCollapsed();
  }
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
    if (isCompactMode()) return;
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
    shellSavePref('layoutWidths', _layoutWidths);
  });
}

function setupLayoutResponsive() {
  if (typeof window === 'undefined') return;
  window.addEventListener('resize', layoutUpdateCompact);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isCompactMode() && (!_layoutCollapsed.rail || !_layoutCollapsed.dock)) {
      closeOverlays();
    }
  });
  if (typeof ResizeObserver !== 'undefined' && document.body) {
    var ro = new ResizeObserver(function () {
      layoutUpdateCompact();
    });
    ro.observe(document.body);
  }
  layoutUpdateCompact();
}

setupLayoutResize();
setupLayoutResponsive();
