// Ownership: the Secret of Mana editor for one map — the sessions (one per map, kept while the page lives)
// and putting the page together from the shared editor shell: the name line, the canvas column (the shell's
// card, pill, zoom chip, filter bar and status bar), the dock. The pieces: editor-stage.js (what is on the
// map), editor-tools.js (the pill, strokes, keys), editor-dock.js (the tabs), editor-model.js (the data).
// The page frame, rail, layout, zoom and pan are the shell's (src/shared/webview/map-editor-shell/); the
// history and the "not saved" notice are the core's (.../map-editor-core/). State owned here: manaEdSessions.
// Nothing is saved anywhere (docs/architecture/multi-game.md): the notice says so.

/** Sessions by map id; a session is {model, history, sel}. */
var manaEdSessions = editSessionStore(function (id) {
  var s = { model: manaEdModel(manaEdLoaded[id]), sel: { obj: -1, step: -1, piece: -1 }, onApply: null, onChange: null };
  s.history = editHistoryCreate(function (change, which) {
    var cells = manaEdApply(s.model, change, which);
    if (s.onApply) s.onApply(cells);
  }, function () { if (s.onChange) s.onChange(); });
  return s;
});
/** `<hex>.edit.json` data waiting for its session to be made. */
var manaEdLoaded = {};

function manaEdHex(n, digits) {
  var s = n.toString(16).toUpperCase();
  while (s.length < digits) s = '0' + s;
  return s;
}

/** Which dock tab shows an overlay while it is open (it edits it), or ''. */
function manaForcedBy(E, key) {
  var st = E.st;
  if (key === 'collision' && st.tab === 'tile' && st.tileSub === 'collision') return 'Tile › Collision';
  if (key === 'specials' && st.tab === 'special') return 'Special';
  if (key === 'triggers' && st.tab === 'trigger') return 'Trigger';
  if (key === 'characters' && st.tab === 'object' && st.objSub === 'characters') return 'Object › Characters';
  if (key === 'objects' && st.tab === 'object' && st.objSub === 'changes') return 'Object › Map changes';
  return '';
}

/** Whether an overlay shows: its chip is on, or the open tab edits it. */
function manaChipOn(E, key) { return !!E.st[key] || !!manaForcedBy(E, key); }

/** The filter bar over the map's bottom edge: the shell's chips, with Mana's views. A chip its tab forces is on and locked. */
function manaFiltersHtml(E) {
  var chip = function (label, key, title) {
    var by = manaForcedBy(E, key);
    return mapViewChipHtml({ label: label, on: manaChipOn(E, key), attrs: { toggle: key }, cls: by ? 'forced' : '',
      title: title + (by ? ' — shown while the ' + by + ' tab is open' : '') });
  };
  return '<div class="rd-filters rg-view-filters">' + mapViewSegHtml([
    chip('BG1', 'a', 'Layer A, drawn on BG1'),
    chip('BG2', 'b', 'Layer B, drawn on BG2'),
    chip('Collision', 'collision', 'Walls, half walls and floor levels of the layer picked in the Tile tab'),
  ]) + chip('Animate', 'animate', 'Play the animated tiles (cells you changed stay still)')
    + chip('Cuttable', 'cut', 'On: the grass and bushes a weapon cuts, outlined (hover for which weapons). Off: the map with them cut')
    + chip('Specials', 'specials', 'Stairs, push and layer switches of the layer picked in the Tile tab (the Special tab)')
    + chip('Objects', 'objects', 'The map’s objects: the parts of it that change with the story, with where each state draws')
    + chip('Characters', 'characters', 'The character records (enemies, people) the game spawns when the map loads')
    + chip('Triggers', 'triggers', 'Step on, walk into and on hit: the cells that run an event, and the exits back to the previous map')
    + chip('Grid', 'grid', 'The 16 px grid') + '</div>';
}

/** Redraw the filter bar (after a chip or a tab changes). */
function manaFiltersRefresh(E) {
  var bar = document.querySelector('.rg-view-filters');
  if (bar) bar.outerHTML = manaFiltersHtml(E);
}

/** The name line's actions: the shell's rail and dock toggles. Called by layout.js whenever they change. */
function renderEditHeadActs() {
  var el = document.getElementById('rg-head-acts');
  if (el) el.innerHTML = shellSidebarTogglesHtml(isRailVisible(), isDockVisible());
}

/**
 * Open the editor for map `ctx.entry` in `#room-detail`. `ctx`: {entry:{id,hex,w,h,name,areaName}, data (edit.json),
 * somBase, state (view prefs, persisted by ctx.save), save(), readJson(path, cb), openVariant(id)}.
 * Returns {close()}: stop the animation and the keyboard and mouse handlers.
 */
function manaEditorOpen(ctx) {
  var entry = ctx.entry, st = ctx.state;
  manaEdLoaded[entry.id] = ctx.data;
  var S = manaEdSessions.get(entry.id), M = S.model;
  var defaults = { tool: 'paint', tab: 'tile', layer: 'A', tile: 0, a: true, b: true, collision: false, animate: true, cut: true, specials: false, objects: true, characters: false, triggers: true, grid: false,
    objSub: 'characters', tileSub: 'tiles', trigSub: 'on', coll: 'pen', level: null, special: 'eff:33' };
  Object.keys(defaults).forEach(function (k) { if (st[k] === undefined) st[k] = defaults[k]; });
  if (st.layer === 'B' && !M.sizeB) st.layer = 'A';
  var E = { ctx: ctx, entry: entry, st: st, S: S, M: M, H: S.history, W: M.w * 16, HPX: M.h * 16, panelOpen: {}, closed: false, raf: 0,
    pan: { panX: 0, panY: 0, panActive: false, panMoved: false, panCX: 0, panCY: 0, panBX: 0, panBY: 0 },
    player: null, svg: null, wrap: null, zp: null, panels: null, drag: null, painting: false };
  // E.H is the history; E.W and E.HPX are the map's size in pixels.

  var panel = document.getElementById('room-detail');
  // The object marks' labels and sub-frames are shown (the Evermore filter bar's ID and Sub-frames chips).
  panel.className = 'rg-theme rg-editing show-obj-id show-obj-frames';
  if (typeof isCompactMode === 'function' && isCompactMode()) panel.classList.add('rg-compact');
  if (_layoutCollapsed.dock) panel.classList.add('dock-collapsed');
  var dispW = 520, dispH = Math.min(600, Math.round(dispW * E.HPX / E.W));
  var parts = shellCanvasParts({ dispW: dispW, dispH: dispH, viewBox: '0 0 ' + (E.W / MANA_UNIT) + ' ' + (E.HPX / MANA_UNIT), filtersHtml: manaFiltersHtml(E),
    statusHtml: shellStatusbarHtml({ width: M.w, height: M.h, cellTitle: 'The cell under the pointer', sizeTitle: 'Map size in 16 px cells' }),
    zoomTitle: 'Zoom — 100% is one game pixel per screen pixel. Ctrl/⌘ + scroll over the map to pinch.' });
  panel.innerHTML = shellHeadHtml({ name: entry.name, tags: [{ cls: 'rd-vid', text: entry.hex }, { cls: 'rd-file', text: entry.note || '' }] })
    + parts.open + manaStageInner(E) + parts.close;
  renderEditHeadActs();

  E.wrap = document.getElementById('rg-wrap');
  E.svg = document.getElementById('rg-svg');
  // The pill hangs off the card's top edge, inside the card (shell-canvas.css).
  document.getElementById('rg-canvas-card').insertAdjacentHTML('afterbegin', manaPillHtml(E));
  var dock = shellDockMount(document.getElementById('rg-outer'));
  E.panels = dock.panels;
  manaDockBind(E);
  manaDockRender(E);
  layoutApplyCollapsed();
  layoutUpdateCompact();

  E.zp = { svg: E.svg, canvas: document.getElementById('rg-canvas'), wrap: E.wrap, W: E.W / MANA_UNIT, H: E.HPX / MANA_UNIT, dispW: dispW, dispH: dispH,
    zoomState: { scale: 0 }, panX: 0, panY: 0 };
  setupZoomPan(E.zp);
  manaStageStart(E);
  manaToolsBind(E);
  shellStatusBind(function (e) {
    var c = manaCellAt(E, e);
    if (!c) return null;
    var a = manaEdCellMetatile(M, 'A', c.x, c.y), b = manaEdCellMetatile(M, 'B', c.x, c.y);
    return 'x: ' + statusPad2(c.x) + ' y: ' + statusPad2(c.y) + ' · A $' + manaEdHex(a, 2) + (b >= 0 ? ' · B $' + manaEdHex(b, 2) : '');
  });
  manaNoteSummary(E);

  S.onApply = function (cells) { manaApplyEverything(E, cells); };
  S.onChange = function () { if (!E.closed) { manaPillRefresh(E); manaNoteSummary(E); } };

  // Clicks on the pill, the filter bar and the name line (the dock has its own, editor-dock.js). `#room-detail`
  // outlives the editor, so the handler goes with it in close(): one left behind ran every click once per map
  // opened, and an even count flipped each chip twice — the filter bar looked dead until the next map.
  var onClick = function (ev) {
    var t = ev.target instanceof Element ? ev.target : null;
    if (!t) return;
    var b = t.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.editTool) { manaSetTool(E, b.dataset.editTool); return; }
    if (b.dataset.manaVariant) { ctx.openVariant(Number(b.dataset.manaVariant)); return; }
    var act = b.dataset.editAct;
    if (act === 'undo') E.H.undo();
    else if (act === 'redo') E.H.redo();
    else if (act === 'toggle-rail') editToggleRail();
    else if (act === 'toggle-dock') editToggleDock();
    var k = b.dataset.toggle;
    if (k) manaToggleView(E, k);
  };
  panel.addEventListener('click', onClick);

  return {
    close: function () {
      E.closed = true;
      panel.removeEventListener('click', onClick);
      manaStageStop(E);
      manaToolsUnbind(E);
      S.onApply = null; S.onChange = null;
    },
  };
}

/** A filter chip: flip the view and redraw only what it changes. */
function manaToggleView(E, k) {
  var st = E.st;
  if (manaForcedBy(E, k)) return;
  st[k] = !st[k];
  if (!st.a && !st.b) st[k === 'a' ? 'b' : 'a'] = true;   // there is no picture of nothing
  E.ctx.save();
  manaFiltersRefresh(E);
  if (k === 'a' || k === 'b') manaStageLayers(E);
  else if (k === 'animate') manaStageAnimate(E);
  else if (k === 'grid') manaStageGrid(E);
  else manaStageOverlays(E);
}
