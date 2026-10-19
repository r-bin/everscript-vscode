// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the dock tabs that edit what a Secret of Mana cell is, not what it shows — Tile › Collision
// (shapes, floor level, the 8 px pen), Special (stairs, push, layer switch) and Trigger (sub-tabs step on, walk
// into, exits and on hit, enter) — and their clicks. The user picks what a cell should be; the solver (editor-props.js)
// finds the metatiles. The dock frame and the other tabs are editor-dock.js'.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

// Each shape as the Evermore Collision tab draws its own: a card with its solid pixels (the shell's swatch grid).
// Mana has only these per 16 px cell (docs/mana/README.md); the pen's squares must make one of them.
var MANA_SHAPES = [['pen', '8px pen', 'draw · carve', 'M0 8h8v8h-8zM8 8h8v8h-8zM0 0h8v8h-8z',
  '8px pen — draws (left button) and carves (right button) 8px squares into the cell’s collision. A cell takes a metatile while its squares make one of the shapes here; others are marked “?” and the cell keeps its own'],
  ['open', 'open', 'no wall', '', 'Nothing in the way'], ['wall', 'solid', 'wall', 'M0 0h16v16h-16z', 'A wall over the whole cell (c0 floor 3)'],
  ['4', 'half wall ◣', 'c2 $1n · 4', 'M0 0L0 16L16 16z', 'The bottom-left half is wall'], ['5', 'half wall ◥', 'c2 $1n · 5', 'M0 0L16 0L16 16z', 'The top-right half is wall'],
  ['6', 'half wall ◤', 'c2 $1n · 6', 'M0 0L16 0L0 16z', 'The top-left half is wall'], ['7', 'half wall ◢', 'c2 $1n · 7', 'M16 0L16 16L0 16z', 'The bottom-right half is wall']];
var MANA_LEVELS = [['keep', 'Keep', 'Keep the cell’s floor level'], ['0', 'None', 'Floor of no level'],
  ['1', 'Level 1', 'A wall to walkers on level 2'], ['2', 'Level 2', 'A wall to walkers on level 1'],
  ['4', 'Any', 'No wall; keeps the walker’s level and sprite priority (the log bridge deck)']];
/** The swatches' colour: the collision overlay's wall red (style.css `.mc-wall`). */
var MANA_WALL_COLOR = 'rgb(230,60,60)';

function manaPalButton(attr, value, label, on, title) {
  return '<button class="rdf mana-pal' + (on ? ' on' : '') + '" data-' + attr + '="' + value + '" title="' + shellEscape(title) + '">' + label + '</button>';
}

/** How many cells carry a wish on the picked layer, and how many no metatile fits. */
function manaWishCount(E) {
  var layer = E.st.layer, s = manaEdSolve(E.M, layer);
  return { drawn: Object.keys(E.M.wish[layer]).length, unfit: s.unfit, copies: s.copies.length, used: s.used, room: s.room };
}

/** Tile › Collision, laid out like the Evermore Collision tab: the floor level, the keys, the shape cards, a foot note. */
function manaCollisionTab(E) {
  var st = E.st, n = manaWishCount(E);
  var lv = st.level === null || st.level === undefined ? 'keep' : String(st.level);
  var levels = '<div class="rg-coll-filters mana-levels"><span class="rs-note">Floor</span>' + MANA_LEVELS.map(function (l) {
    return '<button class="rdf rg-chip-toggle' + (lv === l[0] ? ' on' : '') + '" data-level="' + l[0] + '" aria-pressed="' + (lv === l[0]) + '" title="' + shellEscape(l[2]) + '">' + l[1] + '</button>';
  }).join('') + '</div>';
  var cards = MANA_SHAPES.map(function (s) {
    var pen = s[0] === 'pen';
    return { attrs: { coll: s[0] }, label: s[1], sub: s[2], on: st.coll === s[0], dashed: pen, title: s[4],
      swatch: shellSwatchSvg(s[3], MANA_WALL_COLOR, pen ? '<path d="M8 0v16M0 8h16" stroke="currentColor" stroke-opacity=".5" stroke-width=".6"/>' : '') };
  });
  return levels + shellKeysHtml([['Left', 'draw'], ['Right', 'carve'], ['Eraser', 'back to the metatile’s own']])
    + shellSwatchGridHtml(cards)
    + '<div class="rs-note rg-coll-foot">Mana keeps collision in the metatile: each cell you draw gets a metatile with its picture and this collision — one that already fits, else a copy in a free slot. '
    + 'Squares that make none of these shapes are marked “?” and the cell keeps its own.</div>'
    + '<div class="rs-note">This layer: ' + n.drawn + ' cells drawn · ' + n.copies + ' metatile copies · '
    + n.used + ' / ' + n.room + ' metatiles in use' + (n.unfit ? ' · <b>' + n.unfit + ' marked “?”</b>' : '') + '</div>';
}

/** The Special tab's entries: [group, [value, label, title]]. Values: 'eff:<c2>' or 'sw:<0|1>'. */
function manaSpecialGroups() {
  var push = [];
  for (var sp = 1; sp <= 4; sp++) for (var d = 0; d < 4; d++) {
    push.push(['eff:' + (0x30 | ((sp - 1) << 2) | d), MANA_PUSH_ARROWS[d] + sp, 'Pushes the walker ' + MANA_ED_PUSH_DIRS[d] + ', ' + sp + ' px a frame (c2 $3n, $00:D3DD)']);
  }
  return [['STAIRS', [['eff:33', '≡ Stairs', 'Half speed going up and down (c2 $21, $00:D391)'],
    ['eff:34', '⟋ Rising', 'Half speed sideways, and going right moves the walker up (c2 $22: the log bridge ends)'],
    ['eff:35', '⟍ Falling', 'Half speed sideways, and going right moves the walker down (c2 $23)'],
    ['eff:0', 'None', 'No stairs and no push']]],
    ['PUSH', push],
    ['LAYER', [['sw:1', '⇅ Layer switch', 'Moves the walker to the other layer, A↔B (c0 bit 3, $00:D864); never solid'], ['sw:0', 'No switch', 'The walker stays on its layer']]]];
}

function manaSpecialTab(E) {
  var head = '<div class="rs-note">What a cell does to whoever walks on it, on the layer picked in the Tile tab. Draw with the pencil; erase gives the cell its metatile’s own back.</div>';
  return head + manaSpecialGroups().map(function (g) {
    return manaPanel(E, 'sp-' + g[0], g[0], '<div class="mana-pal-row' + (g[0] === 'PUSH' ? ' mana-pal-grid' : '') + '">'
      + g[1].map(function (e) { return manaPalButton('special', e[0], e[1], E.st.special === e[0], e[2]); }).join('') + '</div>');
  }).join('');
}

/** The wish the Special tab's pick paints: ['eff', {c2}] or ['sw', {on}]. */
function manaSpecialWish(E) {
  var p = String(E.st.special || 'eff:0').split(':'), v = Number(p[1]);
  return p[0] === 'sw' ? ['sw', { on: v === 1 }] : ['eff', { c2: v }];
}

/**
 * The Trigger tab's kinds, as the Evermore Trigger tab's sub-tabs (always shown, each with its count): step
 * events that fire on stepping onto the cell, those that fire on walking into it, the exits and on-hit cells the
 * metatiles carry, and the map's own event on entry. The two step kinds are what the pencil draws.
 */
var MANA_TRIGGER_SUBS = [['on', 'S', 'Step on', 'Step events that run when a party member walks onto the cell (c1 bit 6 set)'],
  ['into', 'W', 'Walk into', 'Step events on a solid cell: they run when a party member walks into it (c1 bit 6 clear, $01:B9A3)'],
  ['cells', 'X', 'Exits · hit', 'Read from the metatiles’ collision: exits back to the previous map (c1 bit 4) and cells that run an event when hit (c2 $Fn)'],
  ['enter', 'E', 'Enter', 'The map’s own event, run as it loads — shown, not drawn']];

/** The open trigger kind: 'on', 'into', 'cells' or 'enter'. */
function manaTrigSub(E) { return E.st.trigSub || 'on'; }

/** The step events of a kind ('on' / 'into'), as their indexes in the map's list. */
function manaStepsOfKind(E, kind) {
  var want = kind === 'into' ? 'walk into' : 'step on', out = [];
  E.M.steps.forEach(function (s, i) { if (manaStepFires(E, s) === want) out.push(i); });
  return out;
}

function manaTriggerSubtabs(E) {
  var sub = manaTrigSub(E), cells = manaCellTriggers(E).length;
  return '<div class="rg-subtabs" role="tablist">' + MANA_TRIGGER_SUBS.map(function (t) {
    var on = sub === t[0];
    var count = t[0] === 'enter' ? '' : ' <span class="rs-note">' + (t[0] === 'cells' ? cells : manaStepsOfKind(E, t[0]).length) + '</span>';
    return '<button class="rg-subtab rg-trigger-kind' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-trig-sub="' + t[0]
      + '" title="' + shellEscape(t[3]) + '"><b>' + t[1] + '</b> ' + t[2] + count + '</button>';
  }).join('') + '</div>';
}

function manaTriggerTab(E) {
  var M = E.M, sub = manaTrigSub(E), head = manaTriggerSubtabs(E);
  if (sub === 'enter') {
    return head + '<div class="rs-note">' + (M.onEnter !== null ? 'The map’s own event on entry: $' + manaEdHex(M.onEnter, 3) + '. ' : 'This map runs no event of its own on entry. ')
      + 'What an event does is not decoded — only its number is shown.</div>';
  }
  if (sub === 'cells') {
    var cells = manaCellTriggers(E).map(function (t) {
      var label = t.kind === 'exit' ? 'step on · exit: back to the previous map' : 'on hit · event $' + manaEdHex(t.event, 3);
      return '<div class="rg-trigger-card"><div class="rg-trigger-row" data-row-cell="' + t.x + ',' + t.y + '" title="Show it on the map">'
        + '<span class="rg-trigger-label">' + shellEscape(label + ' · ' + t.x + ',' + t.y + (t.layer === 'B' ? ' (layer B)' : '')) + '</span></div></div>';
    }).join('') || '<div class="rs-note">none on this map</div>';
    return head + '<div class="rs-note">Exits and on-hit cells are part of a metatile’s collision (an exit is c1 bit 4, on hit is c2 $Fn: event c3×16+n), '
      + 'so they move with the metatile: paint it elsewhere in the Tile tab. Click a row to find it.</div><div class="rg-trigger-list">' + cells + '</div>';
  }
  var sel = E.S.sel.step, s = M.steps[sel], idx = manaStepsOfKind(E, sub);
  var rows = idx.map(function (i) {
    var st = M.steps[i];
    return manaRowHtml('step', i, '#' + i + ' · event $' + manaEdHex(st.event, 3) + ' · ' + st.x + ',' + st.y, i === sel, 'Select this trigger');
  }).join('') || '<div class="rs-note">none yet — click a cell on the map with the pencil</div>';
  var fires = s ? manaStepFires(E, s) : '';
  var inspector = s
    ? manaField('x', 'x', s.x) + manaField('y', 'y', s.y) + manaField('event $', 'event', s.event, true, 3)
      + '<div class="mana-pal-row">' + manaPalButton('fires', 'on', 'Step on', fires === 'step on', MANA_TRIGGER_SUBS[0][3])
      + manaPalButton('fires', 'into', 'Walk into', fires === 'walk into', MANA_TRIGGER_SUBS[1][3]) + '</div>'
    : '<div class="rs-note">Select a trigger to edit its cell, number and how it fires.</div>';
  return head + '<div class="rs-note">Cells that run an event when a party member ' + (sub === 'into' ? 'walks into them (they are solid)' : 'steps on them')
    + '. The pencil places one (of this kind); Select drags it, Delete removes it. What an event does is not decoded — only its number is shown.</div>'
    + '<div class="rg-trigger-list">' + rows + '</div>'
    + manaPanel(E, 'step-sel', 'SELECTED', inspector, String(M.steps.length));
}

/** Clicks in these tabs; true when handled. */
function manaCellDockClick(E, t) {
  var b;
  if ((b = t.closest('[data-tile-sub]'))) { E.st.tileSub = b.dataset.tileSub; return manaCellDockDone(E, true); }
  if ((b = t.closest('[data-trig-sub]'))) { E.st.trigSub = b.dataset.trigSub; return manaCellDockDone(E, true); }
  if ((b = t.closest('[data-coll]'))) { E.st.coll = b.dataset.coll; return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-level]'))) { E.st.level = b.dataset.level === 'keep' ? null : Number(b.dataset.level); return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-special]'))) { E.st.special = b.dataset.special; return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-fires]'))) {
    var s = E.M.steps[E.S.sel.step];
    if (!s) return true;
    var ch = manaEdSetWish(E.M, 'A', manaEdIndex(E.M, 'A', s.x, s.y), 'walk', { on: b.dataset.fires === 'on' });
    if (ch) { E.H.begin(); E.H.record(ch); E.H.end(); }
    // The trigger now belongs to the other kind: follow it there.
    if (E.st.trigSub === 'on' || E.st.trigSub === 'into') E.st.trigSub = manaStepFires(E, s) === 'walk into' ? 'into' : 'on';
    manaStageOverlays(E); manaDockRender(E);
    return true;
  }
  if ((b = t.closest('[data-row-cell]'))) { var q = b.dataset.rowCell.split(','); manaCenterOn(E, Number(q[0]), Number(q[1])); return true; }
  return false;
}

function manaCellDockDone(E, overlays, paint) {
  E.ctx.save();
  if (paint && E.st.tool !== 'paint') manaSetTool(E, 'paint');
  if (overlays) { manaFiltersRefresh(E); manaStageOverlays(E); }
  manaDockRender(E);
  return true;
}
