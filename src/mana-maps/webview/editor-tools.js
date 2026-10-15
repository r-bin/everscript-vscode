// Ownership: the Secret of Mana editor's tools — the floating pill (the shell's shellPillHtml, with the same
// glyphs as the Evermore editor's), what each tool does on a mouse stroke, and the keys. Like the Evermore
// pencil, the open dock tab decides what Paint, Erase and Pick work on: a metatile on the Tile tab, an
// object on the Object tab, a step event on the Trigger tab. Select moves objects and step events, and
// pans the map when it touches nothing.
// Changes go through the history of the core (edit-history.js): one stroke is one undo step.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_TOOLS = [
  ['select', 'select', 'Click an object or step event (on its tab) to select it; drag it to move it. Drag bare ground to pan. Delete removes it', 'v'],
  ['paint', 'pencil', 'Draw what the open tab has: the picked metatile (Tile — its collision comes with it), an object (Object), a step event (Trigger)', 'b'],
  ['erase', 'erase', 'Erase what the open tab draws: metatile 0 (Tile), the object (Object), the step event (Trigger) under the pointer', 'e'],
  ['pick', 'pick', 'Click the map to pick up what is there: the metatile (Tile), or select the object or step event', 'i'],
];

/** The pill, and the "not saved" notice while the map has changes (the editor core's wording). */
function manaPillHtml(E) {
  var H = E.H, st = E.st;
  var tools = MANA_TOOLS.map(function (t) {
    return shellToolButtonHtml({ key: t[0], icon: SHELL_TOOL_ICONS[t[1] === 'pencil' ? 'paint' : t[1]], tip: t[2] + ' (' + t[3].toUpperCase() + ')',
      label: t[1], on: st.tool === t[0] });
  });
  var history = [
    shellActButtonHtml({ act: 'undo', icon: '↶', tip: 'Undo the last change (Ctrl+Z)', label: 'undo', disabled: !H.canUndo() }),
    shellActButtonHtml({ act: 'redo', icon: '↷', tip: 'Redo (Ctrl+Shift+Z)', label: 'redo', disabled: !H.canRedo() }),
  ];
  return shellPillHtml([tools, history], H.dirty()
    ? editNotSavedHtml('Secret of Mana map').replace('class="ed-notsaved"', 'class="ed-notsaved rg-notsaved"') : '');
}

/** Redraw the pill in place (the wrapper is replaced in one write, like the Evermore editor's). */
function manaPillRefresh(E) {
  var chrome = document.getElementById('rg-edit-chrome');
  if (chrome) chrome.outerHTML = manaPillHtml(E);
}

/** What the status line says while nothing else does: how much has changed. */
function manaNoteSummary(E) {
  var n = 0, M = E.M;
  for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) if (manaEdCellChanged(M, x, y)) n++;
  var el = document.getElementById('rg-edit-count');
  if (el) el.textContent = E.H.dirty() ? n + ' cell' + (n === 1 ? '' : 's') + ' changed' : 'nothing changed';
}

function manaApplyEverything(E, cells) {
  var S = E.S, M = E.M;
  S.sel.obj = Math.min(S.sel.obj, M.objects.length - 1);
  S.sel.step = Math.min(S.sel.step, M.steps.length - 1);
  manaStageEdits(E, cells);
  manaStageOverlays(E);
  manaPillRefresh(E);
  manaDockRender(E);
  manaNoteSummary(E);
}

// ── strokes ────────────────────────────────────────────────────────────────

function manaPaintCell(E, c) {
  var n = E.st.tool === 'erase' ? 0 : E.st.tile;
  var ch = manaEdSetCell(E.M, E.st.layer, c.x, c.y, n);
  if (!ch) return;
  E.H.record(ch);
  manaStageEdits(E, E.st.layer === 'A' ? [{ x: c.x, y: c.y }] : null);
  if (E.st.collision || E.st.specials) manaStageOverlaysSoon(E);
}

/** The list a tab edits: {key, list, at(c) -> index}, or null on the Tile and Info tabs. */
function manaTabList(E) {
  if (E.st.tab === 'object') return { kind: 'objects', key: 'obj', list: E.M.objects, at: function (c) { return manaEdObjectAt(E.M, c.x, c.y); } };
  if (E.st.tab === 'trigger') return { kind: 'steps', key: 'step', list: E.M.steps, at: function (c) { return manaEdStepAt(E.M, c.x, c.y); } };
  return null;
}

function manaListAdd(E, tl, c) {
  var M = E.M;
  if (tl.kind === 'objects') {
    if (M.objects.length >= MANA_ED_MAX_OBJECTS) return -1;
    M.objects.push(manaEdNewObject(c.x, c.y, M.objects[E.S.sel.obj] || null));
    return M.objects.length - 1;
  }
  M.steps.push({ x: c.x, y: c.y, event: M.steps[E.S.sel.step] ? M.steps[E.S.sel.step].event : 0 });
  return M.steps.length - 1;
}

function manaListMove(E, drag, c) {
  if (drag.kind === 'objects') manaEdPlaceObject(E.M.objects[drag.i], c.x, c.y);
  else { E.M.steps[drag.i].x = c.x; E.M.steps[drag.i].y = c.y; }
}

function manaRecordList(E, kind, before) {
  var list = kind === 'objects' ? E.M.objects : E.M.steps;
  if (JSON.stringify(list) !== JSON.stringify(before)) E.H.record({ k: kind, before: before, after: manaEdClone(list) });
}

function manaOnDown(E, e) {
  var c = manaCellAt(E, e), st = E.st, tl = manaTabList(E);
  if (!c) { if (st.tool === 'select' && shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault(); return; }
  if (st.tool === 'select') {
    var hit = tl ? tl.at(c) : -1;
    if (hit < 0) { if (shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault(); return; }
    E.S.sel[tl.key] = hit;
    E.H.begin();
    E.drag = { kind: tl.kind, i: hit, before: manaEdClone(tl.list) };
    manaStageOverlays(E); manaDockRender(E);
    e.stopPropagation(); e.preventDefault();
    return;
  }
  e.stopPropagation(); e.preventDefault();
  E.H.begin();
  if (st.tool === 'pick') {
    if (tl) { var i = tl.at(c); if (i >= 0) { E.S.sel[tl.key] = i; manaStageOverlays(E); manaDockRender(E); } }
    else {
      var n = manaEdCell(E.M, st.layer, c.x, c.y);
      if (n >= 0 && n < 192) { st.tile = n; E.ctx.save(); manaDockRender(E); }
    }
    return;
  }
  if (!tl) { E.painting = true; manaPaintCell(E, c); return; }
  var at = tl.at(c);
  if (st.tool === 'erase') {
    if (at < 0) return;
    var before = manaEdClone(tl.list);
    tl.list.splice(at, 1);
    E.S.sel[tl.key] = -1;
    manaRecordList(E, tl.kind, before);
    manaStageOverlays(E); manaDockRender(E);
    return;
  }
  // Paint: add one on an empty cell (or take the one there), then drag it where it goes.
  var snap = manaEdClone(tl.list);
  var idx = at >= 0 ? at : manaListAdd(E, tl, c);
  if (idx < 0) return;
  E.S.sel[tl.key] = idx;
  E.drag = { kind: tl.kind, i: idx, before: snap };
  manaStageOverlays(E); manaDockRender(E);
}

function manaOnMove(E, e) {
  var c = manaCellAt(E, e);
  manaHover(E, c);
  if (!c) return;
  if (E.painting) manaPaintCell(E, c);
  else if (E.drag) { manaListMove(E, E.drag, c); manaStageOverlaysSoon(E); }
}

function manaOnUp(E) {
  if (E.drag) {
    manaRecordList(E, E.drag.kind, E.drag.before);
    E.drag = null;
  }
  E.painting = false;
  E.H.end();
  manaStageOverlays(E);
  manaDockRender(E);
}

/** Delete the selected object or step event of the open tab. */
function manaDeleteSelected(E) {
  var tl = manaTabList(E);
  if (!tl) return;
  var i = E.S.sel[tl.key];
  if (i < 0 || i >= tl.list.length) return;
  var before = manaEdClone(tl.list);
  tl.list.splice(i, 1);
  E.S.sel[tl.key] = -1;
  manaRecordList(E, tl.kind, before);
  E.H.end();
  manaStageOverlays(E); manaDockRender(E);
}

function manaSetTool(E, id) {
  E.st.tool = id;
  E.ctx.save();
  manaPillRefresh(E);
}

/** Wire the map: mouse strokes on the viewport, once per page (the viewport node is new each render). */
function manaToolsBind(E) {
  var wrap = E.wrap;
  wrap.addEventListener('mousedown', function (e) { if (e.button === 0) manaOnDown(E, e); }, true);
  wrap.addEventListener('mousemove', function (e) { manaOnMove(E, e); }, true);
  wrap.addEventListener('mouseleave', function () { manaHover(E, null); }, true);
  // A stroke ends wherever the button comes up, even off the map.
  E.onWindowUp = function () { if (E.painting || E.drag) manaOnUp(E); };
  window.addEventListener('mouseup', E.onWindowUp);
  // The viewport is a pan surface: a click that ended a pan selects nothing.
  svgPanClickGuard(E);
  E.onKey = function (ev) { manaOnKey(E, ev); };
  document.addEventListener('keydown', E.onKey);
}

function svgPanClickGuard(E) {
  E.svg.addEventListener('click', function (ev) { if (E.pan.panMoved) { E.pan.panMoved = false; ev.stopPropagation(); } }, true);
}

function manaToolsUnbind(E) {
  if (E.onWindowUp) window.removeEventListener('mouseup', E.onWindowUp);
  if (E.onKey) document.removeEventListener('keydown', E.onKey);
}

function manaOnKey(E, ev) {
  var t = ev.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
  var h = editHistoryForKey(ev);
  if (h) { ev.preventDefault(); if (h === 'undo') E.H.undo(); else E.H.redo(); return; }
  var tool = editToolForKey(MANA_TOOLS.map(function (m) { return { id: m[0], key: m[3] }; }), ev);
  if (tool) { manaSetTool(E, tool); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); manaDeleteSelected(E); }
}
