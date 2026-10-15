// Ownership: the right-hand dock of the Secret of Mana editor — its tab strip (the shell's
// shellTabStripHtml) and its tabs: Tile › Tiles (the metatile picker and what the picked metatile is), Object
// (the list, drawn with the shell's rows and cards, and an inspector for the selected one) and Info (what the
// map is, and the collision colours). Tile › Collision, Special and Trigger are editor-dock-cells.js'. The dock
// node itself is the shell's (shellDockMount); this file fills it and handles its clicks.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_TABS = [['tile', 'Tile'], ['special', 'Special'], ['object', 'Object'], ['trigger', 'Trigger'], ['info', 'Info']];

function manaPanel(E, key, title, body, note) {
  return shellPanelHtml(key, title, body, note, E.panelOpen[key] !== false);
}

/** The collision bytes of a metatile in words, as the game's movement code reads them (docs/mana/README.md). */
function manaDescribeTile(E, layer, n) {
  var c = manaEdTileCollision(E.M, layer, n), d = manaEdDecodeCollision(c), e = manaEdEffectOf(c), f = c[0] & 7;
  var floor = f === 3 ? 'wall' : f >= 4 ? 'floor of any level' : ['floor of no level', 'level-1 floor', 'level-2 floor'][f];
  var what = e ? (e.kind === 'stairs' ? 'stairs' : e.kind === 'push' ? 'pushes ' + MANA_ED_PUSH_DIRS[e.dir] + ' ' + e.speed + ' px'
    : e.kind === 'cut' ? 'cut by weapon ' + manaEdCutWeapons(e.n) + ' → $' + manaEdHex(e.to, 2) : 'on hit: event $' + manaEdHex(e.event, 3)) : '';
  return 'metatile $' + manaEdHex(n, 2) + ' · collision ' + c.map(function (b) { return manaEdHex(b, 2); }).join(' ') + ' · ' + floor
    + (d.diagonal ? ' · half wall ' + d.diagonal : '') + (what ? ' · ' + what : '') + (d.switches ? ' · layer switch' : '')
    + (c[1] & 0x10 ? ' · exit to the previous map' : '') + (d.special ? ' · special cell $' + manaEdHex(d.special, 2) + (c[1] & 0x40 ? ' (step on)' : ' (walk into)') : '')
    + ' · sprite priority ' + ((c[1] & 7) ? c[1] & 7 : 'kept') + ((c[0] >> 4) & 3 ? ' · height ' + ((c[0] >> 4) & 3) * 16 : '');
}

/** The Tile tab's sub-tabs (the shell's `.rg-subtabs`): the metatiles, and the collision drawn over them. */
function manaTileSubtabs(E) {
  return '<div class="rg-subtabs" role="tablist">' + [['tiles', 'Tiles', 'Paint metatiles: picture and collision together'],
    ['collision', 'Collision', 'Draw the collision you want; the editor finds metatiles that give it']].map(function (t) {
    var on = E.st.tileSub === t[0];
    return '<button class="rg-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-tile-sub="' + t[0] + '" title="' + t[2] + '">' + t[1] + '</button>';
  }).join('') + '</div>';
}

function manaTileTab(E) {
  var st = E.st, M = E.M;
  var head = '<div class="rg-tile-head"><div class="rd-filters">' + mapViewSegHtml([
    mapViewChipHtml({ label: 'Layer A', on: st.layer === 'A', attrs: { layer: 'A' }, title: 'Paint layer A (BG1). Its metatiles carry the collision the player meets.' }),
    mapViewChipHtml({ label: 'Layer B', on: st.layer === 'B', attrs: { layer: 'B' }, cls: M.sizeB ? '' : 'disabled',
      title: M.sizeB ? 'Paint layer B (BG2). It repeats with its own size, so one change shows in every repeat.' : 'This map has no layer B' }),
  ]) + '</div></div>';
  if (st.tileSub === 'collision') return manaTileSubtabs(E) + head + '<div class="rg-tile-scroll">' + manaCollisionTab(E) + '</div>';
  var n = st.tile, sheet = E.ctx.somBase + 'maps/' + E.entry.hex + '.tiles.' + st.layer.toLowerCase() + '.png';
  var picker = '<svg id="mana-picker" class="mana-picker" viewBox="0 0 256 192" width="256" height="192" aria-label="Metatiles">'
    + '<rect width="256" height="192" fill="rgb(' + M.backdrop.join(',') + ')"/>'
    + '<image href="' + sheet + '" x="0" y="0" width="256" height="192"/>'
    + '<rect class="mana-picked" x="' + ((n % 16) * 16 + 0.5) + '" y="' + (Math.floor(n / 16) * 16 + 0.5) + '" width="15" height="15"/></svg>';
  return manaTileSubtabs(E) + head + '<div class="rg-tile-scroll">'
    + manaPanel(E, 'picker', 'METATILES', picker, st.layer === 'A' ? 'layer A' : 'layer B')
    + manaPanel(E, 'picked', 'PICKED', '<div class="rs-note">' + shellEscape(manaDescribeTile(E, st.layer, n)) + '</div>'
      + '<div class="rs-note">Painting a metatile brings its collision; collision drawn in Tile › Collision stays on top of it. The sprite priority and height are read-only.</div>')
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

/** The sub-tabs of the Object tab (the shell's `.rg-subtabs`), with how many each holds. */
function manaObjectSubtabs(E) {
  var subs = [['characters', 'Characters', E.M.objects.length, 'The records the game turns into characters (enemies, people) when the map loads'],
    ['changes', 'Map changes', E.M.pieces.length, 'The parts of the map that change as the story moves on: each is an area with states']];
  return '<div class="rg-subtabs" role="tablist">' + subs.map(function (t) {
    var on = E.st.objSub === t[0];
    return '<button class="rg-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-obj-sub="' + t[0]
      + '" title="' + shellEscape(t[3]) + '">' + t[1] + ' <span class="rs-note">' + t[2] + '</span></button>';
  }).join('') + '</div>';
}

function manaCharactersTab(E) {
  var M = E.M, sel = E.S.sel.obj, o = M.objects[sel];
  var rows = M.objects.map(function (ob, i) {
    var here = manaEdObjectsAt(M, ob.x, ob.y);
    var shared = here.length > 1 ? ' · ' + (here.indexOf(i) + 1) + '/' + here.length + ' on this cell' : '';
    return manaRowHtml('obj', i, '#' + i + ' · kind $' + manaEdHex(ob.kind, 4) + ' · ' + ob.x + ',' + ob.y + shared, i === sel,
      'Select this record and show it on the map\nbytes ' + ob.bytes.map(function (b) { return manaEdHex(b, 2); }).join(' '));
  }).join('') || '<div class="rs-note">none on this map</div>';
  var inspector = o
    ? manaField('x', 'x', o.x) + manaField('y', 'y', o.y) + manaField('kind $', 'kind', o.kind, true, 4)
      + '<div class="mana-bytes">bytes ' + o.bytes.map(function (b) { return manaEdHex(b, 2); }).join(' ') + '</div>'
    : '<div class="rs-note">Select a record to edit its position and kind.</div>';
  return '<div class="rs-note">The records the game turns into characters (enemies, people) when the map loads, drawn as circles. '
    + 'Several records on one cell are one ring with a count: they look like variants of one character, and the game spawns what their flags allow. '
    + 'The pencil places one (it copies the selected record’s bytes, else kind $C001); only position and kind are editable — the other bytes are not decoded and stay as they are.</div>'
    + '<div class="rg-trigger-list">' + rows + '</div>'
    + manaPanel(E, 'obj-sel', 'SELECTED', inspector, M.objects.length + ' / ' + MANA_ED_MAX_OBJECTS);
}

/**
 * A piece's area as it looks in `state`: the map's picture under the area, and that state's cells over it
 * (the Evermore object card's thumbnails). Drawn in game pixels, cropped by the viewBox.
 */
function manaPieceThumb(E, p, state, cls) {
  var x = p.x * 16, y = p.y * 16, w = p.w * 16, h = p.h * 16, maxDim = Math.max(p.w, p.h, 1);
  var tiles = '';
  var f = state >= 1 ? p.frames[state - 1] : null;
  Object.keys(f || {}).forEach(function (k) {
    var q = k.split(',');
    tiles += manaTileGroup(E, p.x + Number(q[0]), p.y + Number(q[1]), f[k].A, f[k].B).outerHTML;
  });
  var size = cls ? 'class="' + cls + '"' : 'class="ro-img" width="' + Math.round(30 * p.w / maxDim) + '" height="' + Math.round(30 * p.h / maxDim) + '"';
  return '<svg ' + size + ' viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
    + '<image href="' + E.ctx.somBase + 'maps/' + E.entry.hex + '.png" x="0" y="0" width="' + E.W + '" height="' + E.HPX + '" preserveAspectRatio="none"/>' + tiles + '</svg>';
}

/** Where the piece sits in the map: the whole map, dimmed, its area lit (the Evermore card's first picture). */
function manaPieceWhere(E, p) {
  return '<svg class="rg-trigger-where" viewBox="0 0 ' + E.W + ' ' + E.HPX + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
    + '<g class="rg-trigger-where-map"><image href="' + E.ctx.somBase + 'maps/' + E.entry.hex + '.png" x="0" y="0" width="' + E.W + '" height="' + E.HPX + '" preserveAspectRatio="none"/></g>'
    + '<rect class="rg-object-where-box" x="' + (p.x * 16) + '" y="' + (p.y * 16) + '" width="' + (p.w * 16) + '" height="' + (p.h * 16) + '" style="stroke-width:6"/></svg>';
}

/** One map change as the Evermore Object tab draws an object: a card with its row, and its states as chips. */
function manaPieceCardHtml(E, p, i) {
  var M = E.M, sel = E.S.sel.piece === i, active = M.pieceState[i] || 0;
  var title = 'Object ' + i + ' — event flag $' + manaEdHex(p.flag, 2) + ', ' + p.w + '×' + p.h + ' cells at ' + p.x + ',' + p.y;
  var chips = '<div class="rg-object-expanded"><div class="ro-chips">';
  for (var s = 0; s <= p.frames.length; s++) {
    var b = s ? manaEdFrameBounds(p, s) : null;
    var tip = s === 0 ? 'State 0 — the map as it opens (every flag 0)'
      : 'State ' + s + ' — from flag $' + manaEdHex(p.flag, 2) + ' = ' + p.values[s] + (b ? ' · ' + b.w + '×' + b.h + ' (' + b.count + ' cells)' : ' · same as base');
    chips += '<div class="rg-anim-frame-col"><button class="ro-chip' + (active === s ? ' sel' : '') + '" data-piece-state="' + i + ':' + s + '" title="' + shellEscape(tip) + '">'
      + manaPieceThumb(E, p, s) + '<span class="ro-lbl">' + s + '</span></button><span class="rs-note">' + (s === 0 ? '0' : '= ' + p.values[s]) + '</span></div>';
  }
  chips += '</div>';
  if (active >= 1) {
    var cur = manaEdFrameBounds(p, active);
    chips += '<div class="rg-object-frame-bar"><span class="rg-obj-frame-info">State ' + active + ' (flag $' + manaEdHex(p.flag, 2) + ' = ' + p.values[active] + '): '
      + (cur ? cur.w + '×' + cur.h + ' (' + cur.count + ' cells)' : 'same as base') + '</span>'
      + '<button class="rdf rdf-xs" data-piece-state="' + i + ':' + (active - 1) + '" title="' + (active === 1 ? 'State 0 (the map as it opens)' : 'State ' + (active - 1)) + '">◀</button>'
      + '<button class="rdf rdf-xs" data-piece-state="' + i + ':' + (active + 1) + '" title="State ' + (active + 1) + '"' + (active >= p.frames.length ? ' disabled' : '') + '>▶</button></div>';
  }
  chips += '</div>';
  return '<div class="rg-object-card' + (sel ? ' on' : '') + '"><div class="rg-trigger-row' + (sel ? ' on' : '') + '" data-piece="' + i + '" title="' + shellEscape(title) + '">'
    + manaPieceWhere(E, p) + manaPieceThumb(E, p, active, 'rg-trigger-tiles')
    + '<span class="rg-trigger-label">#' + i + ' · ' + p.w + '×' + p.h + ' cells'
    + '<span class="rg-trigger-what">flag $' + manaEdHex(p.flag, 2) + ' · state ' + active + ' of ' + p.frames.length + '</span></span></div>' + chips + '</div>';
}

function manaChangesTab(E) {
  var cards = E.M.pieces.map(function (p, i) { return manaPieceCardHtml(E, p, i); }).join('')
    || '<div class="rs-note">This map has no parts that change with the story.</div>';
  return '<div class="rs-note">Areas of the map that change as the story moves on (an event flag): state 0 is the map as it opens, each further state is what a higher flag value changes. '
    + 'Pick a state to see the map with it; a dashed box outlines each area and where its states draw. Read-only for now.</div>' + cards;
}

function manaObjectTab(E) {
  return manaObjectSubtabs(E) + (E.st.objSub === 'changes' ? manaChangesTab(E) : manaCharactersTab(E));
}

function manaInfoTab(E) {
  var M = E.M, e = E.entry;
  var row = function (k, v) { return '<div class="mana-info-row"><span>' + k + '</span><b>' + shellEscape(v) + '</b></div>'; };
  var map = row('map', e.hex + ' (' + e.id + ')') + row('size', M.w + ' × ' + M.h + ' cells')
    + row('layer B', M.sizeB ? M.sizeB.w + ' × ' + M.sizeB.h + ', repeated' : 'none')
    + row('objects', String(M.objects.length)) + row('triggers', String(M.steps.length))
    + ['A', 'B'].filter(function (l) { return l === 'A' || M.sizeB; }).map(function (l) {
      var sv = manaEdSolve(M, l);
      return row('layer ' + l + ' metatiles', sv.used + ' / ' + sv.room + (sv.copies.length ? ' (' + sv.copies.length + ' copies)' : '') + (sv.unfit ? ' · ' + sv.unfit + ' “?”' : ''));
    }).join('')
    + row('area', e.areaName || '—');
  var legend = [['mc-wall', 'wall'], ['mc-diag', 'half wall (diagonal)'], ['mc-l1', 'level-1 floor — a wall to walkers on level 2'],
    ['mc-l0', 'floor of no level'], ['sw-plain', 'level-2 floor, or any level'], ['mw-quarters', '8 px squares you drew'], ['mw-unfit', '“?”: no metatile gives what you drew']]
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
  var body = tab === 'tile' ? manaTileTab(E) : tab === 'special' ? manaSpecialTab(E) : tab === 'object' ? manaObjectTab(E)
    : tab === 'trigger' ? manaTriggerTab(E) : manaInfoTab(E);
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
    if (tab) { E.st.tab = tab.dataset.manaTab; E.ctx.save(); manaDockRender(E); manaFiltersRefresh(E); manaStageOverlays(E); return; }
    if (manaCellDockClick(E, t)) return;
    var head = t.closest('[data-panel]');
    if (head) { var k = head.dataset.panel; E.panelOpen[k] = E.panelOpen[k] === false; manaDockRender(E); return; }
    var layer = t.closest('[data-layer]');
    if (layer) { if (layer.classList.contains('disabled')) return; E.st.layer = layer.dataset.layer; E.ctx.save(); manaDockRender(E); manaStageOverlays(E); return; }
    var pick = t.closest('#mana-picker');
    if (pick) {
      var r = pick.getBoundingClientRect(), k2 = 256 / r.width;
      var n = Math.floor((ev.clientX - r.left) * k2 / 16) + 16 * Math.floor((ev.clientY - r.top) * k2 / 16);
      if (n >= 0 && n < 192) { E.st.tile = n; E.ctx.save(); if (E.st.tool === 'erase' || E.st.tool === 'pick' || E.st.tool === 'select') manaSetTool(E, 'paint'); manaDockRender(E); }
      return;
    }
    var del = t.closest('[data-del-obj],[data-del-step]');
    if (del) { var isObj = del.dataset.delObj !== undefined; E.S.sel[isObj ? 'obj' : 'step'] = Number(isObj ? del.dataset.delObj : del.dataset.delStep); manaDeleteSelected(E); return; }
    var sub = t.closest('[data-obj-sub]');
    if (sub) { E.st.objSub = sub.dataset.objSub; E.ctx.save(); manaFiltersRefresh(E); manaStageOverlays(E); manaDockRender(E); return; }
    var chip = t.closest('[data-piece-state]');
    if (chip) {
      if (chip.disabled) return;
      var cs = chip.dataset.pieceState.split(':'), pi = Number(cs[0]);
      E.S.sel.piece = pi; E.M.pieceState[pi] = Number(cs[1]);
      manaStageEdits(E, null); manaStageOverlays(E); manaPillRefresh(E); manaDockRender(E); manaNoteSummary(E);
      return;
    }
    var card = t.closest('[data-piece]');
    if (card) {
      var ci = Number(card.dataset.piece), pc = E.M.pieces[ci];
      E.S.sel.piece = ci; manaStageMarks(E); manaDockRender(E);
      manaCenterOn(E, pc.x + (pc.w - 1) / 2, pc.y + (pc.h - 1) / 2);
      return;
    }
    var row = t.closest('[data-row-obj],[data-row-step]');
    if (row) {
      var o = row.dataset.rowObj !== undefined, ri = Number(o ? row.dataset.rowObj : row.dataset.rowStep);
      E.S.sel[o ? 'obj' : 'step'] = ri;
      var target = o ? E.M.objects[ri] : E.M.steps[ri];
      manaStageOverlays(E); manaDockRender(E);
      if (target) manaCenterOn(E, target.x, target.y);
    }
  });
  dock.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t instanceof HTMLInputElement && t.dataset.f) manaApplyField(E, t.dataset.f, t.value);
  });
}
