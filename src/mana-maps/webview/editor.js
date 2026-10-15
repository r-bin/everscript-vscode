// Ownership: the Secret of Mana map editor's page — the stage (picture, redrawn cells, overlays),
// the tools, the picker and the inspector — built on the game-neutral core in
// src/shared/webview/map-editor-core/ (history, sessions, grid strokes, tool strip) and on the
// model in editor-model.js. State owned here: the sessions (one per map, kept while the page lives).
// Nothing is saved anywhere (docs/architecture/one-map-editor.md): the notice says so.
//
// The stage is three layers, bottom to top: the map's own picture (+ the animation), a canvas with
// only the cells the user changed (redrawn from the metatile sheets: no priority, no colour math),
// and an SVG of overlays and hit targets. Uses buildMapSvg, drawCollision, drawSpecials,
// playAnimation (map-svg.js) and the chips of map-view/view-chips.js.

var MANA_ED_TOOLS = [
  { id: 'paint', label: 'Paint', key: 'b', title: 'Paint the picked metatile. Its collision comes with it: Mana keeps collision per metatile, not per cell' },
  { id: 'erase', label: 'Erase', key: 'e', title: 'Set cells to metatile 0 (the first metatile of the set)' },
  { id: 'pick', label: 'Pick', key: 'i', title: 'Pick the metatile under the pointer' },
  { id: 'objects', label: 'Objects', key: 'o', title: 'Place, move and delete the map’s objects (click an empty cell to place one)' },
  { id: 'triggers', label: 'Triggers', key: 't', title: 'Add, move and delete step events (click an empty cell to add one)' },
];

/** Sessions by map id; a session is {model, history, sel}. */
var manaEdSessions = editSessionStore(function (id) {
  var s = { model: manaEdModel(manaEdLoaded[id]), sel: { obj: -1, step: -1 }, onApply: null, onChange: null };
  s.history = editHistoryCreate(function (change, which) {
    var cells = manaEdApply(s.model, change, which);
    if (s.onApply) s.onApply(cells);
  }, function () { if (s.onChange) s.onChange(); });
  return s;
});
/** `<hex>.edit.json` data waiting for its session to be made. */
var manaEdLoaded = {};

var MANA_ED_ZOOMS = [0.5, 1, 2, 3];

function manaEdHex(n, digits) {
  var s = n.toString(16).toUpperCase();
  while (s.length < digits) s = '0' + s;
  return s;
}

/**
 * Open the editor for map `ctx.entry` in `ctx.root`. `ctx`: {root, entry:{id,hex,w,h}, data (edit.json),
 * somBase, state (view prefs, persisted by ctx.save), save(), readJson(path, cb), onBack()}.
 * Returns {close()} — stop the animation and the keyboard handler.
 */
function manaEditorOpen(ctx) {
  var entry = ctx.entry, st = ctx.state, root = ctx.root;
  manaEdLoaded[entry.id] = ctx.data;
  var S = manaEdSessions.get(entry.id), M = S.model, H = S.history;
  if (!st.tool) st.tool = 'paint';
  if (!st.layer || (st.layer === 'B' && !M.sizeB)) st.layer = 'A';
  if (typeof st.tile !== 'number') st.tile = 0;
  if (!st.ezoom) st.ezoom = 2;
  if (st.triggers === undefined) st.triggers = true;
  var zoom = st.ezoom;
  var player = null, closed = false, over = null, edits = null, ectx = null, baseSvg = null;
  var sheets = { A: null, B: null };
  var hover = null, drag = null, raf = 0;

  root.innerHTML = '<div class="ed"><div class="ed-bar" id="ed-tools"></div><div class="ed-bar" id="ed-view"></div>'
    + '<div id="ed-notice"></div><div class="ed-body"><div class="ed-scroll"><div class="ed-stage" id="ed-stage"></div></div>'
    + '<aside class="ed-side"><canvas id="ed-picker" aria-label="Metatiles"></canvas><div id="ed-info" class="ed-info"></div>'
    + '<div id="ed-inspector" class="ed-inspector"></div></aside></div></div>';
  var bar = root.querySelector('#ed-tools'), viewBar = root.querySelector('#ed-view'), notice = root.querySelector('#ed-notice');
  var stage = root.querySelector('#ed-stage'), picker = root.querySelector('#ed-picker');
  var info = root.querySelector('#ed-info'), inspector = root.querySelector('#ed-inspector');

  function loadSheet(layer) {
    var img = new Image();
    img.onload = function () { sheets[layer] = img; if (layer === st.layer) drawPicker(); drawEdits(null); };
    img.src = ctx.somBase + 'maps/' + entry.hex + '.tiles.' + layer.toLowerCase() + '.png';
  }

  // ── bars ───────────────────────────────────────────────────────────────────
  function drawBars() {
    var layer = mapViewSegHtml([
      mapViewChipHtml({ label: 'Edit A', on: st.layer === 'A', attrs: { layer: 'A' }, title: 'Paint layer A (BG1). Its metatiles carry the collision the player meets.' }),
      mapViewChipHtml({ label: 'Edit B', on: st.layer === 'B', attrs: { layer: 'B' }, cls: M.sizeB ? '' : 'disabled',
        title: M.sizeB ? 'Paint layer B (BG2). It repeats with its own size, so one change shows in every repeat.' : 'This map has no layer B' }),
    ]);
    bar.innerHTML = '<button class="rdf" data-edit-act="back" title="Back to the maps">← Maps</button>' + editToolsHtml(MANA_ED_TOOLS, st.tool, H) + layer;
    var chip = function (label, key, title) { return mapViewChipHtml({ label: label, on: !!st[key], attrs: { toggle: key }, title: title }); };
    viewBar.innerHTML = mapViewSegHtml([chip('BG1', 'a', 'Layer A as drawn on BG1'), chip('BG2', 'b', 'Layer B as drawn on BG2'),
      chip('Collision', 'collision', 'What the player bumps into, from the metatiles’ collision bytes')])
      + chip('Animate', 'animate', 'Play the animated tiles (cells you changed stay still)')
      + chip('Specials', 'specials', 'Special cells (collision byte 1 bit 7)')
      + chip('Objects', 'objects', 'The map’s objects')
      + chip('Triggers', 'triggers', 'Step events: the cells that run an event when stepped on')
      + '<span class="zoom-chips">' + MANA_ED_ZOOMS.map(function (z) {
        return mapViewChipHtml({ label: z === 0.5 ? '½×' : z + '×', on: zoom === z, attrs: { ezoom: z } });
      }).join('') + '</span>';
    notice.innerHTML = H.dirty() ? editNotSavedHtml('Secret of Mana map') : '';
  }

  // ── stage ──────────────────────────────────────────────────────────────────
  function buildStage() {
    stopPlayer();
    stage.textContent = '';
    var W = M.w * 16, Hh = M.h * 16, pw = Math.round(W * zoom), ph = Math.round(Hh * zoom);
    stage.style.width = pw + 'px'; stage.style.height = ph + 'px';
    baseSvg = buildMapSvg(entry, zoom);
    baseSvg.querySelector('.mm-picture').setAttribute('href', mapPictureUrl(ctx.somBase, entry.hex, { a: st.a, b: st.b }));
    edits = document.createElement('canvas');
    edits.className = 'ed-edits'; edits.width = pw; edits.height = ph;
    ectx = edits.getContext('2d'); ectx.imageSmoothingEnabled = false;
    over = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: pw, height: ph, 'class': 'ed-over' });
    over.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: Hh, fill: 'transparent', 'class': 'ed-hit' }));
    stage.append(baseSvg, edits, over);
    editGridBind(over, { cell: 16, scale: function () { return zoom; }, w: function () { return M.w; }, h: function () { return M.h; },
      onDown: onDown, onMove: onMove, onUp: onUp, onHover: onHover });
    if (st.animate && st.a && st.b) {
      ctx.readJson('maps/' + entry.hex + '.anim.json', function (a) {
        if (closed || !baseSvg.isConnected) return;
        player = playAnimation(baseSvg, a);
      });
    }
    drawEdits(null);
    drawOverlays();
  }
  function stopPlayer() { if (player) { player.stop(); player = null; } }

  /** Redraw the changed cells: `cells` ([{x,y}]) or null for every cell. */
  function drawEdits(cells) {
    if (!ectx) return;
    var z = zoom, px = 16 * z;
    var one = function (x, y) {
      ectx.clearRect(x * px, y * px, px, px);
      if (!manaEdCellChanged(M, x, y)) return;
      ectx.fillStyle = 'rgb(' + M.backdrop.join(',') + ')';
      ectx.fillRect(x * px, y * px, px, px);
      ['B', 'A'].forEach(function (layer) {
        var n = manaEdCell(M, layer, x, y), sheet = sheets[layer];
        if (!sheet || n < 0 || n > 191 || !(layer === 'A' ? st.a : st.b)) return;
        ectx.drawImage(sheet, (n % 16) * 16, Math.floor(n / 16) * 16, 16, 16, x * px, y * px, px, px);
      });
    };
    if (cells) { cells.forEach(function (c) { one(c.x, c.y); }); return; }
    ectx.clearRect(0, 0, edits.width, edits.height);
    for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) one(x, y);
  }

  function drawOverlays() {
    if (!over) return;
    over.querySelectorAll('.mm-collision, .mm-specials, .ed-triggers, .ed-objects').forEach(function (e) { e.remove(); });
    if (st.collision || st.specials) {
      var c = manaEdCollisionView(M);
      if (st.collision) drawCollision(over, c);
      if (st.specials) drawSpecials(over, c);
    }
    // The tool's own things are always shown: there is nothing to edit under a hidden overlay.
    if (st.triggers || st.tool === 'triggers') over.appendChild(triggersGroup());
    if (st.objects || st.tool === 'objects') over.appendChild(objectsGroup());
  }
  function scheduleOverlays() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; if (!closed) drawOverlays(); });
  }

  function triggersGroup() {
    var g = svgEl('g', { 'class': 'ed-triggers', 'pointer-events': 'none' });
    M.steps.forEach(function (s, i) {
      g.appendChild(svgEl('rect', { x: s.x * 16 + 1, y: s.y * 16 + 1, width: 14, height: 14, 'class': 'ed-trig' + (st.tool === 'triggers' && S.sel.step === i ? ' sel' : '') }));
      var t = svgEl('text', { x: s.x * 16 + 8, y: s.y * 16 + 11, 'class': 'ms-label' });
      t.textContent = manaEdHex(s.event, 3);
      g.appendChild(t);
    });
    return g;
  }
  function objectsGroup() {
    var g = svgEl('g', { 'class': 'ed-objects', 'pointer-events': 'none' });
    M.objects.forEach(function (o, i) {
      g.appendChild(svgEl('circle', { cx: o.x * 16 + 8, cy: o.y * 16 + 8, r: 6, 'class': 'mo-ring' + (st.tool === 'objects' && S.sel.obj === i ? ' sel' : '') }));
      var t = svgEl('text', { x: o.x * 16 + 8, y: o.y * 16 - 1, 'class': 'mo-label' });
      t.textContent = manaEdHex(o.kind, 4);
      g.appendChild(t);
    });
    return g;
  }

  // ── picker, info, inspector ────────────────────────────────────────────────
  var PZ = 2;
  function drawPicker() {
    var c = picker.getContext('2d');
    picker.width = 16 * 16 * PZ; picker.height = 12 * 16 * PZ;
    c.imageSmoothingEnabled = false;
    c.fillStyle = 'rgb(' + M.backdrop.join(',') + ')';
    c.fillRect(0, 0, picker.width, picker.height);
    var sheet = sheets[st.layer];
    if (sheet) c.drawImage(sheet, 0, 0, sheet.width, sheet.height, 0, 0, picker.width, picker.height);
    var n = st.tile;
    c.strokeStyle = '#ffd84a'; c.lineWidth = 2;
    c.strokeRect((n % 16) * 16 * PZ + 1, Math.floor(n / 16) * 16 * PZ + 1, 16 * PZ - 2, 16 * PZ - 2);
  }
  function describeTile(layer, n) {
    var c = manaEdTileCollision(M, layer, n), d = manaEdDecodeCollision(c);
    var floor = ['floor of no level', 'level-1 floor', 'level-2 floor', 'wall'][d.floor];
    return 'metatile $' + manaEdHex(n, 2) + ' · collision ' + c.map(function (b) { return manaEdHex(b, 2); }).join(' ') + ' · ' + floor
      + (d.diagonal ? ' · half wall ' + d.diagonal : '') + (d.switches ? ' · level switch' : '') + (d.special ? ' · special $' + manaEdHex(d.special, 2) : '');
  }
  function drawInfo() {
    var lines = ['<b>Picked:</b> ' + describeTile(st.layer, st.tile)];
    if (hover) {
      var a = manaEdCell(M, 'A', hover.x, hover.y), b = manaEdCell(M, 'B', hover.x, hover.y);
      lines.push('<b>Cell ' + hover.x + ',' + hover.y + ':</b> A $' + manaEdHex(a, 2) + (b >= 0 ? ' · B $' + manaEdHex(b, 2) : '') + '<br>' + describeTile('A', a));
    }
    info.innerHTML = lines.join('<br>');
  }
  var inputRow = function (label, f, v, hex) {
    return '<label>' + label + ' <input data-f="' + f + '" value="' + (hex ? manaEdHex(v, f === 'kind' ? 4 : 3) : v) + '" size="5"' + (hex ? '' : ' type="number" min="0" max="127"') + '></label>';
  };
  function drawInspector() {
    var html = '';
    if (st.tool === 'objects') {
      var o = M.objects[S.sel.obj];
      html = '<h3>Objects <span>' + M.objects.length + ' / ' + MANA_ED_MAX_OBJECTS + '</span></h3>'
        + (o ? inputRow('x', 'x', o.x) + inputRow('y', 'y', o.y) + inputRow('kind $', 'kind', o.kind, true)
          + '<div class="ed-bytes">bytes ' + o.bytes.map(function (b) { return manaEdHex(b, 2); }).join(' ') + '</div>'
          + '<button class="rdf" data-edit-act="delete">Delete</button>'
          : '<p>Click an object to select it, or an empty cell to place one (it copies the selected object, else kind $C001). Only position and kind are editable; the other bytes are not decoded and stay as they are.</p>');
    } else if (st.tool === 'triggers') {
      var s = M.steps[S.sel.step];
      html = '<h3>Step events <span>' + M.steps.length + '</span></h3>'
        + (s ? inputRow('x', 'x', s.x) + inputRow('y', 'y', s.y) + inputRow('event $', 'event', s.event, true)
          + '<button class="rdf" data-edit-act="delete">Delete</button>'
          : '<p>Click a cell with an event to select it, or an empty one to add one. What an event does is not decoded; only its number is shown.</p>')
        + (M.onEnter !== null ? '<p>The map’s own event on entry: $' + manaEdHex(M.onEnter, 3) + '</p>' : '');
    } else {
      html = '<p>Pick a metatile in the sheet, then paint. Collision follows the metatile, so turn Collision on to see it change.</p>';
    }
    inspector.innerHTML = html;
  }
  function refreshAll() { drawBars(); drawInfo(); drawInspector(); }

  S.onApply = function (cells) {
    // Undo/redo can change anything: object or trigger lists, a cell of either layer.
    S.sel.obj = Math.min(S.sel.obj, M.objects.length - 1);
    S.sel.step = Math.min(S.sel.step, M.steps.length - 1);
    drawEdits(cells); drawOverlays(); drawInfo(); drawInspector();
  };
  S.onChange = function () { if (!closed) drawBars(); };

  // ── tools ──────────────────────────────────────────────────────────────────
  function stroke(x, y) {
    var n = st.tool === 'erase' ? 0 : st.tile;
    var ch = manaEdSetCell(M, st.layer, x, y, n);
    if (!ch) return;
    H.record(ch);
    drawEdits(st.layer === 'A' ? [{ x: x, y: y }] : null);
    if (st.collision || st.specials) scheduleOverlays();
  }
  function onDown(x, y) {
    H.begin();
    if (st.tool === 'paint' || st.tool === 'erase') stroke(x, y);
    else if (st.tool === 'pick') {
      var n = manaEdCell(M, st.layer, x, y);
      if (n >= 0 && n < 192) { st.tile = n; ctx.save(); drawPicker(); drawInfo(); }
    } else if (st.tool === 'objects') {
      var i = manaEdObjectAt(M, x, y), snap = manaEdClone(M.objects);
      if (i < 0) {
        if (M.objects.length >= MANA_ED_MAX_OBJECTS) { H.end(); return; }
        M.objects.push(manaEdNewObject(x, y, M.objects[S.sel.obj] || null));
        i = M.objects.length - 1;
      }
      S.sel.obj = i; drag = { kind: 'objects', i: i, before: snap };
      drawOverlays(); drawInspector();
    } else if (st.tool === 'triggers') {
      var j = manaEdStepAt(M, x, y), snapS = manaEdClone(M.steps);
      if (j < 0) { M.steps.push({ x: x, y: y, event: M.steps[S.sel.step] ? M.steps[S.sel.step].event : 0 }); j = M.steps.length - 1; }
      S.sel.step = j; drag = { kind: 'steps', i: j, before: snapS };
      drawOverlays(); drawInspector();
    }
  }
  function onMove(x, y) {
    hover = { x: x, y: y };
    if (st.tool === 'paint' || st.tool === 'erase') stroke(x, y);
    else if (drag && drag.kind === 'objects') { manaEdPlaceObject(M.objects[drag.i], x, y); scheduleOverlays(); }
    else if (drag && drag.kind === 'steps') { M.steps[drag.i].x = x; M.steps[drag.i].y = y; scheduleOverlays(); }
  }
  function onUp() {
    if (drag) {
      var list = drag.kind === 'objects' ? M.objects : M.steps;
      if (JSON.stringify(list) !== JSON.stringify(drag.before)) H.record({ k: drag.kind, before: drag.before, after: manaEdClone(list) });
      drag = null;
      drawInspector();
    }
    H.end();
    drawOverlays(); drawInfo();
  }
  function onHover(x, y) {
    if (hover && hover.x === x && hover.y === y) return;
    hover = { x: x, y: y };
    drawInfo();
  }

  function deleteSelected() {
    var kind = st.tool === 'objects' ? 'objects' : st.tool === 'triggers' ? 'steps' : null;
    if (!kind) return;
    var list = kind === 'objects' ? M.objects : M.steps, key = kind === 'objects' ? 'obj' : 'step', i = S.sel[key];
    if (i < 0 || i >= list.length) return;
    var before = manaEdClone(list);
    list.splice(i, 1);
    S.sel[key] = -1;
    H.record({ k: kind, before: before, after: manaEdClone(list) });
    H.end();
    drawOverlays(); drawInspector();
  }

  /** The inspector's inputs: x, y, kind / event. */
  function applyField(f, raw) {
    var kind = st.tool === 'objects' ? 'objects' : 'steps', list = kind === 'objects' ? M.objects : M.steps;
    var it = list[kind === 'objects' ? S.sel.obj : S.sel.step];
    if (!it) return;
    var before = manaEdClone(list);
    if (f === 'x' || f === 'y') {
      var v = Math.max(0, Math.min((f === 'x' ? M.w : M.h) - 1, parseInt(raw, 10) || 0));
      if (kind === 'objects') manaEdPlaceObject(it, f === 'x' ? v : it.x, f === 'y' ? v : it.y);
      else it[f] = v;
    } else if (f === 'kind') manaEdSetKind(it, parseInt(raw, 16) || 0);
    else if (f === 'event') it.event = (parseInt(raw, 16) || 0) & 0xFFF;
    if (JSON.stringify(list) === JSON.stringify(before)) { drawInspector(); return; }
    H.record({ k: kind, before: before, after: manaEdClone(list) });
    H.end();
    drawOverlays(); drawInspector();
  }

  // ── events ─────────────────────────────────────────────────────────────────
  function setTool(id) { st.tool = id; ctx.save(); drawBars(); drawInspector(); drawOverlays(); }
  function setLayer(layer) {
    if (layer === 'B' && !M.sizeB) return;
    st.layer = layer; ctx.save();
    if (!sheets[layer]) loadSheet(layer);
    drawBars(); drawPicker(); drawInfo();
  }
  bar.addEventListener('click', function (ev) {
    var b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (!b || b.disabled) return;
    if (b.dataset.editTool) setTool(b.dataset.editTool);
    else if (b.dataset.layer) setLayer(b.dataset.layer);
    else if (b.dataset.editAct === 'undo') H.undo();
    else if (b.dataset.editAct === 'redo') H.redo();
    else if (b.dataset.editAct === 'back') ctx.onBack();
  });
  viewBar.addEventListener('click', function (ev) {
    var b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (!b) return;
    if (b.dataset.ezoom) { zoom = st.ezoom = Number(b.dataset.ezoom) || 2; ctx.save(); drawBars(); buildStage(); return; }
    var k = b.dataset.toggle;
    if (!k) return;
    st[k] = !st[k];
    if (!st.a && !st.b) st[k === 'a' ? 'b' : 'a'] = true;
    ctx.save();
    drawBars();
    if (k === 'a' || k === 'b' || k === 'animate') buildStage(); else drawOverlays();
  });
  picker.addEventListener('click', function (ev) {
    var r = picker.getBoundingClientRect();
    var sx = picker.width / r.width;
    var n = Math.floor((ev.clientX - r.left) * sx / (16 * PZ)) + 16 * Math.floor((ev.clientY - r.top) * sx / (16 * PZ));
    if (n < 0 || n > 191) return;
    st.tile = n; ctx.save();
    if (st.tool !== 'paint') st.tool = 'paint';
    drawBars(); drawPicker(); drawInfo();
  });
  inspector.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t instanceof HTMLInputElement && t.dataset.f) applyField(t.dataset.f, t.value);
  });
  inspector.addEventListener('click', function (ev) {
    var b = ev.target instanceof Element ? ev.target.closest('button') : null;
    if (b && b.dataset.editAct === 'delete') deleteSelected();
  });
  function onKey(ev) {
    var t = ev.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
    var h = editHistoryForKey(ev);
    if (h) { ev.preventDefault(); if (h === 'undo') H.undo(); else H.redo(); return; }
    var tool = editToolForKey(MANA_ED_TOOLS, ev);
    if (tool) { setTool(tool); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); deleteSelected(); }
  }
  document.addEventListener('keydown', onKey);

  loadSheet('A');
  if (M.sizeB) loadSheet('B');
  refreshAll();
  drawPicker();
  buildStage();
  return {
    close: function () {
      closed = true; stopPlayer();
      document.removeEventListener('keydown', onKey);
      S.onApply = null; S.onChange = null;
    },
  };
}
