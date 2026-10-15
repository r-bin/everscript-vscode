// Ownership: the dock tabs that edit what a Secret of Mana cell is, not what it shows — Tile › Collision
// (shapes, floor level, the 8 px pen), Special (stairs, push, layer switch) and Trigger (step on / walk into,
// exits, on hit) — and their clicks. The user picks what a cell should be; the solver (editor-props.js)
// finds the metatiles. The dock frame and the other tabs are editor-dock.js'.
// State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_SHAPES = [['pen', '8 px pen', 'Draw 8 px squares (left button) or carve them (right button) into the cell’s collision'],
  ['open', 'Open', 'Nothing in the way'], ['wall', 'Wall', 'A wall over the whole cell'],
  ['4', 'Half ◣', 'The bottom-left half is wall'], ['5', 'Half ◥', 'The top-right half is wall'],
  ['6', 'Half ◤', 'The top-left half is wall'], ['7', 'Half ◢', 'The bottom-right half is wall']];
var MANA_LEVELS = [['keep', 'Keep', 'Keep the cell’s floor level'], ['0', 'None', 'Floor of no level'],
  ['1', 'Level 1', 'A wall to walkers on level 2'], ['2', 'Level 2', 'A wall to walkers on level 1'],
  ['4', 'Any', 'No wall; keeps the walker’s level and sprite priority (the log bridge deck)']];

function manaPalButton(attr, value, label, on, title) {
  return '<button class="rdf mana-pal' + (on ? ' on' : '') + '" data-' + attr + '="' + value + '" title="' + shellEscape(title) + '">' + label + '</button>';
}

/** How many cells carry a wish on the picked layer, and how many no metatile fits. */
function manaWishCount(E) {
  var layer = E.st.layer, s = manaEdSolve(E.M, layer);
  return { drawn: Object.keys(E.M.wish[layer]).length, unfit: s.unfit, copies: s.copies.length, used: s.used, room: s.room };
}

function manaCollisionTab(E) {
  var st = E.st, n = manaWishCount(E);
  var shapes = MANA_SHAPES.map(function (s) { return manaPalButton('coll', s[0], s[1], st.coll === s[0], s[2]); }).join('');
  var lv = st.level === null || st.level === undefined ? 'keep' : String(st.level);
  var levels = MANA_LEVELS.map(function (l) { return manaPalButton('level', l[0], l[1], lv === l[0], l[2]); }).join('');
  return '<div class="rs-note">Draw the collision you want. Mana keeps collision in the metatile, so the editor gives each cell a metatile with its picture and this collision: one that already fits, else a copy in a free slot. '
    + 'Mana has walls, open floor and four half walls per 16 px cell, nothing finer: 8 px squares that make none of them are marked “?”, and the cell keeps its own.</div>'
    + manaPanel(E, 'coll-shapes', 'SHAPE', '<div class="mana-pal-row">' + shapes + '</div>')
    + manaPanel(E, 'coll-level', 'FLOOR LEVEL', '<div class="mana-pal-row">' + levels + '</div>')
    + manaPanel(E, 'coll-count', 'THIS LAYER', '<div class="rs-note">' + n.drawn + ' cells drawn · ' + n.copies + ' metatile copies · '
      + n.used + ' / ' + n.room + ' metatiles in use' + (n.unfit ? ' · <b>' + n.unfit + ' marked “?”</b>' : '') + '</div>'
      + '<div class="rs-note">Erase takes the drawing away: the cell gets its metatile’s own collision back.</div>');
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

function manaTriggerTab(E) {
  var M = E.M, sel = E.S.sel.step, s = M.steps[sel];
  var rows = M.steps.map(function (st, i) {
    return manaRowHtml('step', i, '#' + i + ' · ' + manaStepFires(E, st) + ' · event $' + manaEdHex(st.event, 3) + ' · ' + st.x + ',' + st.y, i === sel, 'Select this trigger');
  }).join('') || '<div class="rs-note">none on this map</div>';
  var cells = manaCellTriggers(E).map(function (t) {
    var label = t.kind === 'exit' ? 'step on · exit: back to the previous map' : 'on hit · event $' + manaEdHex(t.event, 3);
    return '<div class="rg-trigger-card"><div class="rg-trigger-row" data-row-cell="' + t.x + ',' + t.y + '" title="Show it on the map">'
      + '<span class="rg-trigger-label">' + shellEscape(label + ' · ' + t.x + ',' + t.y + (t.layer === 'B' ? ' (layer B)' : '')) + '</span></div></div>';
  }).join('');
  var fires = s ? manaStepFires(E, s) : '';
  var inspector = s
    ? manaField('x', 'x', s.x) + manaField('y', 'y', s.y) + manaField('event $', 'event', s.event, true, 3)
      + '<div class="mana-pal-row">' + manaPalButton('fires', 'on', 'Step on', fires === 'step on', 'Runs when a party member walks onto the cell (c1 bit 6 set)')
      + manaPalButton('fires', 'into', 'Walk into', fires === 'walk into', 'The cell is solid and runs when a party member walks into it (c1 bit 6 clear, $01:B9A3)') + '</div>'
    : '<div class="rs-note">Select a trigger to edit its cell, number and how it fires.</div>';
  return '<div class="rs-note">Cells that run an event when a party member steps on them, walks into them (they are solid) or hits them with an attack, and the exits that take the party back to the map it came from. '
    + 'What an event does is not decoded — only its number is shown.</div>'
    + (M.onEnter !== null ? '<div class="rs-note">The map’s own event on entry: $' + manaEdHex(M.onEnter, 3) + '</div>' : '')
    + '<div class="rg-trigger-list">' + rows + '</div>'
    + manaPanel(E, 'step-sel', 'SELECTED', inspector, String(M.steps.length))
    + (cells ? manaPanel(E, 'cell-trig', 'EXITS AND ON HIT', '<div class="rg-trigger-list">' + cells + '</div>'
      + '<div class="rs-note">Read from the metatiles’ collision: an exit is c1 bit 4, on hit is c2 $Fn (event c3×16+n).</div>') : '');
}

/** Clicks in these tabs; true when handled. */
function manaCellDockClick(E, t) {
  var b;
  if ((b = t.closest('[data-tile-sub]'))) { E.st.tileSub = b.dataset.tileSub; return manaCellDockDone(E, true); }
  if ((b = t.closest('[data-coll]'))) { E.st.coll = b.dataset.coll; return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-level]'))) { E.st.level = b.dataset.level === 'keep' ? null : Number(b.dataset.level); return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-special]'))) { E.st.special = b.dataset.special; return manaCellDockDone(E, false, true); }
  if ((b = t.closest('[data-fires]'))) {
    var s = E.M.steps[E.S.sel.step];
    if (!s) return true;
    var ch = manaEdSetWish(E.M, 'A', manaEdIndex(E.M, 'A', s.x, s.y), 'walk', { on: b.dataset.fires === 'on' });
    if (ch) { E.H.begin(); E.H.record(ch); E.H.end(); }
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
