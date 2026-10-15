// Ownership: the right-hand dock of the Secret of Mana editor — its tab strip (the shell's
// shellTabStripHtml) and the four tabs: Tile (the metatile picker and what the picked metatile is),
// Object and Trigger (the list, drawn with the shell's rows and cards, and an inspector for the selected
// one) and Info (what the map is, and the collision colours). The dock node itself is the shell's
// (shellDockMount); this file fills it and handles its clicks.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_TABS = [['tile', 'Tile'], ['object', 'Object'], ['trigger', 'Trigger'], ['info', 'Info']];

function manaPanel(E, key, title, body, note) {
  return shellPanelHtml(key, title, body, note, E.panelOpen[key] !== false);
}

/** The collision bytes of a metatile in words, as the game's movement code reads them (docs/mana/README.md). */
function manaDescribeTile(E, layer, n) {
  var c = manaEdTileCollision(E.M, layer, n), d = manaEdDecodeCollision(c);
  var floor = ['floor of no level', 'level-1 floor', 'level-2 floor', 'wall'][d.floor];
  return 'metatile $' + manaEdHex(n, 2) + ' · collision ' + c.map(function (b) { return manaEdHex(b, 2); }).join(' ') + ' · ' + floor
    + (d.diagonal ? ' · half wall ' + d.diagonal : '') + (d.switches ? ' · level switch' : '') + (d.special ? ' · special $' + manaEdHex(d.special, 2) : '');
}

function manaTileTab(E) {
  var st = E.st, M = E.M;
  var head = '<div class="rg-tile-head"><div class="rd-filters">' + mapViewSegHtml([
    mapViewChipHtml({ label: 'Layer A', on: st.layer === 'A', attrs: { layer: 'A' }, title: 'Paint layer A (BG1). Its metatiles carry the collision the player meets.' }),
    mapViewChipHtml({ label: 'Layer B', on: st.layer === 'B', attrs: { layer: 'B' }, cls: M.sizeB ? '' : 'disabled',
      title: M.sizeB ? 'Paint layer B (BG2). It repeats with its own size, so one change shows in every repeat.' : 'This map has no layer B' }),
  ]) + '</div></div>';
  var n = st.tile, sheet = E.ctx.somBase + 'maps/' + E.entry.hex + '.tiles.' + st.layer.toLowerCase() + '.png';
  var picker = '<svg id="mana-picker" class="mana-picker" viewBox="0 0 256 192" width="256" height="192" aria-label="Metatiles">'
    + '<rect width="256" height="192" fill="rgb(' + M.backdrop.join(',') + ')"/>'
    + '<image href="' + sheet + '" x="0" y="0" width="256" height="192"/>'
    + '<rect class="mana-picked" x="' + ((n % 16) * 16 + 0.5) + '" y="' + (Math.floor(n / 16) * 16 + 0.5) + '" width="15" height="15"/></svg>';
  return head + '<div class="rg-tile-scroll">'
    + manaPanel(E, 'picker', 'METATILES', picker, st.layer === 'A' ? 'layer A' : 'layer B')
    + manaPanel(E, 'picked', 'PICKED', '<div class="rs-note">' + shellEscape(manaDescribeTile(E, st.layer, n)) + '</div>'
      + '<div class="rs-note">Collision belongs to the metatile in Mana, not the cell: painting this changes the picture and the collision together.</div>')
    + '</div>';
}

/** One list row, in the shell's card/row look. */
function manaRowHtml(attr, i, label, on, title) {
  return '<div class="rg-trigger-card' + (on ? ' on' : '') + '"><div class="rg-trigger-row' + (on ? ' on' : '') + '" data-row-' + attr + '="' + i
    + '" title="' + shellEscape(title) + '"><span class="rg-trigger-label">' + shellEscape(label) + '</span>'
    + '<button class="rdf rg-trigger-remove" data-del-' + attr + '="' + i + '" title="Remove">×</button></div></div>';
}

function manaField(label, f, v, hex, digits) {
  return '<label class="mana-field">' + label + ' <input data-f="' + f + '" value="' + (hex ? manaEdHex(v, digits) : v) + '" size="5"'
    + (hex ? '' : ' type="number" min="0" max="127"') + '></label>';
}

function manaObjectTab(E) {
  var M = E.M, sel = E.S.sel.obj, o = M.objects[sel];
  var rows = M.objects.map(function (ob, i) {
    return manaRowHtml('obj', i, '#' + i + ' · kind $' + manaEdHex(ob.kind, 4) + ' · ' + ob.x + ',' + ob.y, i === sel, 'Select this object');
  }).join('') || '<div class="rs-note">none on this map</div>';
  var inspector = o
    ? manaField('x', 'x', o.x) + manaField('y', 'y', o.y) + manaField('kind $', 'kind', o.kind, true, 4)
      + '<div class="mana-bytes">bytes ' + o.bytes.map(function (b) { return manaEdHex(b, 2); }).join(' ') + '</div>'
    : '<div class="rs-note">Select an object to edit its position and kind.</div>';
  return '<div class="rs-note">The map’s objects: the records the game turns into characters (enemies, people) when it loads. '
    + 'The pencil places one (it copies the selected object’s bytes, else kind $C001); only position and kind are editable — the other bytes are not decoded and stay as they are.</div>'
    + '<div class="rg-trigger-list">' + rows + '</div>'
    + manaPanel(E, 'obj-sel', 'SELECTED', inspector, M.objects.length + ' / ' + MANA_ED_MAX_OBJECTS);
}

function manaTriggerTab(E) {
  var M = E.M, sel = E.S.sel.step, s = M.steps[sel];
  var rows = M.steps.map(function (st, i) {
    return manaRowHtml('step', i, '#' + i + ' · event $' + manaEdHex(st.event, 3) + ' · ' + st.x + ',' + st.y, i === sel, 'Select this step event');
  }).join('') || '<div class="rs-note">none on this map</div>';
  var inspector = s
    ? manaField('x', 'x', s.x) + manaField('y', 'y', s.y) + manaField('event $', 'event', s.event, true, 3)
    : '<div class="rs-note">Select a step event to edit its cell and number.</div>';
  return '<div class="rs-note">Step events: the cells that run an event when a character steps onto them. '
    + 'What an event does is not decoded — only its number is shown.</div>'
    + (M.onEnter !== null ? '<div class="rs-note">The map’s own event on entry: $' + manaEdHex(M.onEnter, 3) + '</div>' : '')
    + '<div class="rg-trigger-list">' + rows + '</div>'
    + manaPanel(E, 'step-sel', 'SELECTED', inspector, String(M.steps.length));
}

function manaInfoTab(E) {
  var M = E.M, e = E.entry;
  var row = function (k, v) { return '<div class="mana-info-row"><span>' + k + '</span><b>' + shellEscape(v) + '</b></div>'; };
  var map = row('map', e.hex + ' (' + e.id + ')') + row('size', M.w + ' × ' + M.h + ' cells')
    + row('layer B', M.sizeB ? M.sizeB.w + ' × ' + M.sizeB.h + ', repeated' : 'none')
    + row('objects', String(M.objects.length)) + row('step events', String(M.steps.length))
    + row('area', e.areaName || '—');
  var legend = [['mc-wall', 'wall'], ['mc-diag', 'half wall (diagonal)'], ['mc-l1', 'level-1 floor — a wall to walkers on level 2'],
    ['mc-l0', 'floor of both levels (stairs, ramps)'], ['sw-plain', 'level-2 floor'], ['mc-switch', 'changes the walker’s level']]
    .map(function (l) { return '<div class="mana-legend-row"><i class="sw ' + l[0] + '"></i>' + l[1] + '</div>'; }).join('');
  return manaPanel(E, 'info-map', 'MAP', map)
    + manaPanel(E, 'info-coll', 'COLLISION COLOURS', legend, 'Collision chip')
    + '<div class="rs-note">Changes are never written: Mana’s map data is compressed and a changed map often would not fit its old slot.</div>';
}

/** Redraw the dock: the tab strip and the open tab's body. */
function manaDockRender(E) {
  var dock = E.panels;
  if (!dock) return;
  var tab = E.st.tab;
  var body = tab === 'tile' ? manaTileTab(E) : tab === 'object' ? manaObjectTab(E) : tab === 'trigger' ? manaTriggerTab(E) : manaInfoTab(E);
  var scroll = dock.querySelector('.rg-tab-body, .rg-tile-scroll');
  var top = scroll ? scroll.scrollTop : 0;
  dock.innerHTML = shellTabStripHtml(MANA_TABS.map(function (t) { return { value: t[0], label: t[1], on: t[0] === tab }; }), 'mana-tab')
    + '<div class="rg-tab-body" id="rg-tab-body" data-tab="' + tab + '">' + body + '</div>';
  var again = dock.querySelector(tab === 'tile' ? '.rg-tile-scroll' : '.rg-tab-body');
  if (again && top) again.scrollTop = top;
}

/** An inspector field changed. */
function manaApplyField(E, f, raw) {
  var tl = manaTabList(E);
  if (!tl) return;
  var it = tl.list[E.S.sel[tl.key]];
  if (!it) return;
  var before = manaEdClone(tl.list), M = E.M;
  if (f === 'x' || f === 'y') {
    var v = Math.max(0, Math.min((f === 'x' ? M.w : M.h) - 1, parseInt(raw, 10) || 0));
    if (tl.kind === 'objects') manaEdPlaceObject(it, f === 'x' ? v : it.x, f === 'y' ? v : it.y);
    else it[f] = v;
  } else if (f === 'kind') manaEdSetKind(it, parseInt(raw, 16) || 0);
  else if (f === 'event') it.event = (parseInt(raw, 16) || 0) & 0xFFF;
  manaRecordList(E, tl.kind, before);
  E.H.end();
  manaStageOverlays(E);
  manaDockRender(E);
}

/** Wire the dock once (its node outlives every redraw of its contents). */
function manaDockBind(E) {
  var dock = E.panels;
  if (dock.dataset.manaBound) return;
  dock.dataset.manaBound = '1';
  dock.addEventListener('click', function (ev) {
    var t = ev.target instanceof Element ? ev.target : null;
    if (!t) return;
    var tab = t.closest('[data-mana-tab]');
    if (tab) { E.st.tab = tab.dataset.manaTab; E.ctx.save(); manaDockRender(E); manaStageOverlays(E); return; }
    var head = t.closest('[data-panel]');
    if (head) { var k = head.dataset.panel; E.panelOpen[k] = E.panelOpen[k] === false; manaDockRender(E); return; }
    var layer = t.closest('[data-layer]');
    if (layer) { if (layer.classList.contains('disabled')) return; E.st.layer = layer.dataset.layer; E.ctx.save(); manaDockRender(E); return; }
    var pick = t.closest('#mana-picker');
    if (pick) {
      var r = pick.getBoundingClientRect(), k2 = 256 / r.width;
      var n = Math.floor((ev.clientX - r.left) * k2 / 16) + 16 * Math.floor((ev.clientY - r.top) * k2 / 16);
      if (n >= 0 && n < 192) { E.st.tile = n; E.ctx.save(); if (E.st.tool === 'erase' || E.st.tool === 'pick' || E.st.tool === 'select') manaSetTool(E, 'paint'); manaDockRender(E); }
      return;
    }
    var del = t.closest('[data-del-obj],[data-del-step]');
    if (del) { var isObj = del.dataset.delObj !== undefined; E.S.sel[isObj ? 'obj' : 'step'] = Number(isObj ? del.dataset.delObj : del.dataset.delStep); manaDeleteSelected(E); return; }
    var row = t.closest('[data-row-obj],[data-row-step]');
    if (row) { var o = row.dataset.rowObj !== undefined; E.S.sel[o ? 'obj' : 'step'] = Number(o ? row.dataset.rowObj : row.dataset.rowStep); manaStageOverlays(E); manaDockRender(E); }
  });
  dock.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t instanceof HTMLInputElement && t.dataset.f) manaApplyField(E, t.dataset.f, t.value);
  });
}
