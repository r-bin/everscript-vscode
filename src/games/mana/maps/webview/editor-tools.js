// Ownership: the Secret of Mana editor's tools — the floating pill (the shell's shellPillHtml, with the same
// glyphs as the Evermore editor's), what each tool does on a mouse stroke, and the keys. Like the Evermore
// pencil, the open dock tab decides what Paint, Erase and Pick work on: a metatile on Tile › Tiles, the
// collision wish on Tile › Collision (the 8 px pen carves with the right button), the Special tab's wish,
// an object on the Object tab, a trigger on the Trigger tab. Select moves objects and step events, and
// pans the map when it touches nothing.
// Changes go through the history of the core (edit-history.js): one stroke is one undo step.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_TOOLS = [
  ['select', 'select', 'Click an object or step event (on its tab) to select it; drag it to move it. Drag bare ground to pan. Delete removes it', 'v'],
  ['paint', 'pencil', 'Draw what the open tab has: the picked metatile (Tile), the collision (Tile › Collision; the 8 px pen carves with the right button), stairs, push or a layer switch (Special), an object (Object), a trigger (Trigger)', 'b'],
  ['erase', 'erase', 'Erase what the open tab draws: metatile 0 (Tile), the drawn collision or special (back to the metatile’s own), the object or trigger under the pointer', 'e'],
  ['pick', 'pick', 'Click the map to pick up what is there: the metatile, its shape or its special, or select the object or trigger', 'i'],
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
  return shellPillHtml([tools, history], manaVariantBarHtml(E) + (H.dirty()
    ? editNotSavedHtml('Secret of Mana map').replace('class="ed-notsaved"', 'class="ed-notsaved rg-notsaved"') : ''));
}

/**
 * The maps that draw the same picture as this one (same sets and pieces; their own characters and scripts), as the
 * shell's side bar on the card's right edge — the Evermore level bar's twin. '' when the map has no variants.
 */
function manaVariantBarHtml(E) {
  var v = E.entry.variants || [];
  if (v.length < 2) return '';
  return shellSideBarHtml({ id: 'rg-variant-bar', cls: 'rg-variant-bar', label: 'Variant', items: v.map(function (x, i) {
    return { text: String(i + 1), attr: { 'mana-variant': x.id }, on: x.id === E.entry.id, color: 'var(--rg-accent)',
      tip: 'Map ' + x.hex + ' (' + x.id + ') — draws the same picture, with its own characters and scripts' };
  }) });
}

/** Redraw the pill in place (the wrapper is replaced in one write, like the Evermore editor's). */
function manaPillRefresh(E) {
  var chrome = document.getElementById('rg-edit-chrome');
  if (chrome) chrome.outerHTML = manaPillHtml(E);
}

/** What the status line says while nothing else does: how much has changed. */
function manaNoteSummary(E) {
  var n = 0, M = E.M;
  for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) if (manaEdCellEdited(M, x, y)) n++;
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

/** What a stroke draws on the open tab: 'tile', 'coll' (Tile › Collision), 'special', or null (a list tab). */
function manaStrokeKind(E) {
  if (E.st.tab === 'tile') return E.st.tileSub === 'collision' ? 'coll' : 'tile';
  return E.st.tab === 'special' ? 'special' : null;
}

/** One cell of a wish stroke: the collision or the special wanted there (or none, erasing). */
function manaWishCell(E, c) {
  var st = E.st, M = E.M, layer = st.layer === 'B' && M.sizeB ? 'B' : 'A', i = manaEdIndex(M, layer, c.x, c.y), chs = [];
  var add = function (field, w) { var ch = manaEdSetWish(M, layer, i, field, w); if (ch) chs.push(ch); };
  if (manaStrokeKind(E) === 'coll') {
    if (st.tool === 'erase') add('coll', null);
    else if (st.coll !== 'pen') add('coll', { shape: /^\d$/.test(st.coll) ? Number(st.coll) : st.coll, level: st.level });
    else {
      var at = manaEdWishAt(M, layer, c.x, c.y), cur = at.wish && at.wish.coll && at.wish.coll.quarters !== undefined ? at.wish.coll.quarters
        : manaEdQuartersOf(manaEdShapeOf(manaEdCellBytes(M, layer, c.x, c.y)));
      var q = E.carving ? cur & ~c.q : cur | c.q;
      if (q !== cur || !(at.wish && at.wish.coll)) add('coll', { quarters: q, level: st.level });
    }
  } else if (st.tool === 'erase') { add('eff', null); add('sw', null); }
  else { var w = manaSpecialWish(E); add(w[0], w[1]); }
  chs.forEach(function (ch) { E.H.record(ch); });
  if (chs.length) manaStageOverlaysSoon(E);
}

function manaPaintCell(E, c) {
  if (manaStrokeKind(E) !== 'tile') { manaWishCell(E, c); return; }
  var n = E.st.tool === 'erase' ? 0 : E.st.tile;
  var ch = manaEdSetCell(E.M, E.st.layer, c.x, c.y, n);
  if (!ch) return;
  E.H.record(ch);
  manaStageEdits(E, E.st.layer === 'A' ? [{ x: c.x, y: c.y }] : null);
  manaStageOverlaysSoon(E);
}

/**
 * The list the open tab edits: {kind, key, list, at(c), pick(c)}, or null on the Tile, Map changes and Info tabs.
 * `at` is the topmost entry on a cell; `pick` steps through the ones stacked there (a second click on the same
 * cell takes the next record, so records on one cell can all be reached).
 */
function manaTabList(E) {
  var M = E.M, S = E.S;
  if (E.st.tab === 'object' && E.st.objSub === 'characters') {
    return { kind: 'objects', key: 'obj', list: M.objects, at: function (c) { return manaEdObjectAt(M, c.x, c.y); },
      pick: function (c) {
        var all = manaEdObjectsAt(M, c.x, c.y), i = all.indexOf(S.sel.obj);
        return !all.length ? -1 : i >= 0 ? all[(i + 1) % all.length] : all[all.length - 1];
      } };
  }
  if (E.st.tab === 'trigger' && (manaTrigSub(E) === 'on' || manaTrigSub(E) === 'into')) {
    var at = function (c) { return manaEdStepAt(M, c.x, c.y); };
    return { kind: 'steps', key: 'step', list: M.steps, at: at, pick: at };
  }
  return null;
}

/** On the Map changes sub-tab: the piece whose area holds the cell. Select and Pick choose it; nothing there is editable. */
function manaPiecesActive(E) { return E.st.tab === 'object' && E.st.objSub === 'changes'; }

/** Scroll the map so cell (x, y) is in the middle of the viewport. */
function manaCenterOn(E, x, y) {
  var zp = E.zp, m = zp._getViewportMetrics(), s = zp._getScale(zp.zoomState.scale);
  var cx = (x + 0.5) * MANA_CELL, cy = (y + 0.5) * MANA_CELL;
  zp._applyPan(Math.min(m.maxX, Math.max(m.minX, m.wW / 2 - cx * s)), Math.min(m.maxY, Math.max(m.minY, m.wH / 2 - cy * s)));
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
  // The right button carves with the 8 px pen; elsewhere it is left to the page.
  E.carving = e.button === 2;
  if (E.carving && !(c && manaStrokeKind(E) === 'coll' && st.coll === 'pen' && st.tool === 'paint')) { E.carving = false; return; }
  if (!c) { if (st.tool === 'select' && shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault(); return; }
  if (manaPiecesActive(E) && (st.tool === 'select' || st.tool === 'pick')) {
    var pi = manaEdPieceAt(E.M, c.x, c.y);
    if (pi >= 0) { E.S.sel.piece = pi; manaStageMarks(E); manaDockRender(E); e.stopPropagation(); e.preventDefault(); return; }
    if (st.tool === 'select' && shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault();
    return;
  }
  if (st.tool === 'select') {
    var hit = tl ? tl.pick(c) : -1;
    if (hit < 0) { if (shellPanStart(E.zp, E.pan, E.wrap, e)) e.preventDefault(); return; }
    E.S.sel[tl.key] = hit;
    manaFollowStep(E, tl, hit);
    E.H.begin();
    E.drag = { kind: tl.kind, i: hit, before: manaEdClone(tl.list) };
    manaStageOverlays(E); manaDockRender(E);
    e.stopPropagation(); e.preventDefault();
    return;
  }
  e.stopPropagation(); e.preventDefault();
  E.H.begin();
  if (st.tool === 'pick') {
    if (tl) { var i = tl.pick(c); if (i >= 0) { E.S.sel[tl.key] = i; manaFollowStep(E, tl, i); manaStageOverlays(E); manaDockRender(E); } }
    else manaPickCell(E, c);
    return;
  }
  if (manaPiecesActive(E)) return;   // the map's changes are read-only
  if (!tl && !manaStrokeKind(E)) return;   // Info, and the trigger kinds the pencil does not draw
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
  E.drag = { kind: tl.kind, i: idx, before: snap, added: at < 0 };
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
    if (E.drag.added && E.drag.kind === 'steps') manaStepFitKind(E, E.M.steps[E.drag.i]);
    E.drag = null;
  }
  E.painting = false;
  E.carving = false;
  E.H.end();
  manaStageOverlays(E);
  manaDockRender(E);
}

/** A step event picked on the map shows on its own kind's sub-tab (step on / walk into). */
function manaFollowStep(E, tl, i) {
  if (tl.kind === 'steps' && E.M.steps[i]) E.st.trigSub = manaStepFires(E, E.M.steps[i]) === 'walk into' ? 'into' : 'on';
}

/** A step event placed on a Trigger sub-tab fires the way that sub-tab says: its cell gets a wish when it does not already. */
function manaStepFitKind(E, s) {
  var sub = manaTrigSub(E);
  if (!s || (sub !== 'on' && sub !== 'into') || (manaStepFires(E, s) === 'walk into') === (sub === 'into')) return;
  var ch = manaEdSetWish(E.M, 'A', manaEdIndex(E.M, 'A', s.x, s.y), 'walk', { on: sub === 'on' });
  if (ch) E.H.record(ch);
}

/** Pick: the metatile (Tile), the cell's shape (Collision) or its stairs / push / switch (Special). */
function manaPickCell(E, c) {
  var st = E.st, kind = manaStrokeKind(E), layer = st.layer === 'B' && E.M.sizeB ? 'B' : 'A';
  var b = manaEdCellBytes(E.M, layer, c.x, c.y);
  if (kind === 'coll') { st.coll = String(manaEdShapeOf(b)); st.level = manaEdLevelOf(b); }
  else if (kind === 'special') {
    var e = manaEdEffectOf(b);
    st.special = e && (e.kind === 'stairs' || e.kind === 'push') ? 'eff:' + e.c2 : b[0] & 8 ? 'sw:1' : 'eff:0';
  } else {
    var n = manaEdCell(E.M, st.layer, c.x, c.y);
    if (n < 0 || n > 191) return;
    st.tile = n;
  }
  E.ctx.save();
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
  wrap.addEventListener('mousedown', function (e) { if (e.button === 0 || e.button === 2) manaOnDown(E, e); }, true);
  wrap.addEventListener('contextmenu', function (e) { if (manaStrokeKind(E) === 'coll') e.preventDefault(); }, true);
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
