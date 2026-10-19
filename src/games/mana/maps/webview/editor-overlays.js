// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the overlays of the Secret of Mana editor that read a cell's properties (editor-props.js) — the
// collision of the picked layer with the 8 px drawings and the cells no metatile fits, the Special tab's
// properties (stairs, push, layer switch), the triggers (step-on, walk-into, on hit) and the cuttable cells
// (outlined while the Cuttable chip is on, drawn cut while it is off). Drawn in pixels inside `#rg-over`.
// What each chip shows is what one dock tab edits: Collision ↔ Tile › Collision, Specials ↔ Special,
// Triggers ↔ Trigger. State lives on the editor instance `E` (editor.js); nothing is owned here.

var MANA_PUSH_ARROWS = ['↑', '↓', '←', '→'];

/** Every cell of the map with its bytes in `layer` (layer B repeats): fn(x, y, bytes). */
function manaEachCell(E, layer, fn) {
  var M = E.M;
  if (layer === 'B' && !M.sizeB) return;
  for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) fn(x, y, manaEdCellBytes(M, layer, x, y));
}

function manaLabel(g, x, y, text, cls) {
  var t = svgEl('text', { x: x * 16 + 8, y: y * 16 + 11, 'class': cls || 'ms-label' });
  t.textContent = text;
  g.appendChild(t);
}

/** Collision of the picked layer, then the wishes on it: the drawn 8 px quarters, and "?" where nothing fits. */
function manaCollisionOverlay(E, host) {
  var M = E.M, layer = E.st.layer === 'B' && M.sizeB ? 'B' : 'A';
  drawCollision(host, manaEdCollisionView(M, layer));
  var g = svgEl('g', { 'class': 'mm-wishes', 'pointer-events': 'none' }), q = '';
  for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) {
    var at = manaEdWishAt(M, layer, x, y), c = at.wish && at.wish.coll;
    if (c && c.quarters !== undefined) {
      [[1, 0, 0], [2, 8, 0], [4, 0, 8], [8, 8, 8]].forEach(function (b) {
        if (c.quarters & b[0]) q += 'M' + (x * 16 + b[1] + 0.5) + ' ' + (y * 16 + b[2] + 0.5) + 'h7v7h-7z';
      });
    }
    if (at.solved && at.solved.unfit) {
      g.appendChild(svgEl('rect', { x: x * 16 + 0.5, y: y * 16 + 0.5, width: 15, height: 15, 'class': 'mw-unfit' }));
      manaLabel(g, x, y, '?', 'mw-unfit-label');
    }
  }
  if (q) g.insertBefore(svgEl('path', { d: q, 'class': 'mw-quarters' }), g.firstChild);
  host.appendChild(g);
}

/** The Special tab's properties on the picked layer: stairs, push (arrow and speed), layer switch. */
function manaSpecialsOverlay(E, host) {
  var layer = E.st.layer === 'B' && E.M.sizeB ? 'B' : 'A';
  var g = svgEl('g', { 'class': 'mm-specials', 'pointer-events': 'none' });
  manaEachCell(E, layer, function (x, y, c) {
    var e = manaEdEffectOf(c);
    if (c[0] & 8) g.appendChild(svgEl('rect', { x: x * 16 + 2, y: y * 16 + 2, width: 12, height: 12, 'class': 'mc-switch' }));
    if (e && e.kind === 'stairs') manaLabel(g, x, y, MANA_STAIRS_GLYPH[c[2]] || '≡', 'mp-label');
    else if (e && e.kind === 'push') manaLabel(g, x, y, MANA_PUSH_ARROWS[e.dir] + e.speed, 'mp-label');
    else if (c[0] & 8) manaLabel(g, x, y, '⇅', 'mp-label');
  });
  host.appendChild(g);
}

/** Return cells (step-on exits) and strike cells (on hit) of both layers: [{x, y, layer, kind, event}]. */
function manaCellTriggers(E) {
  var out = [];
  ['A', 'B'].forEach(function (layer) {
    manaEachCell(E, layer, function (x, y, c) {
      if (c[1] & 0x10) out.push({ x: x, y: y, layer: layer, kind: 'exit' });
      var e = manaEdEffectOf(c);
      if (e && e.kind === 'strike') out.push({ x: x, y: y, layer: layer, kind: 'hit', event: e.event });
    });
  });
  return out;
}

/** How a step event's cell fires: walked onto (c1 bit 6 set) or bumped into (solid, `$01:B9A3`). */
function manaStepFires(E, s) { return manaEdCellBytes(E.M, 'A', s.x, s.y)[1] & 0x40 ? 'step on' : 'walk into'; }

/** Step events (step on / walk into), return cells and strike cells. */
function manaTriggersGroup(E) {
  var g = svgEl('g', { 'class': 'ed-triggers', 'pointer-events': 'none' });
  E.M.steps.forEach(function (s, i) {
    var into = manaStepFires(E, s) === 'walk into';
    g.appendChild(svgEl('rect', { x: s.x * 16 + 1, y: s.y * 16 + 1, width: 14, height: 14,
      'class': 'ed-trig' + (into ? ' into' : '') + (E.S.sel.step === i ? ' sel' : '') }));
    manaLabel(g, s.x, s.y, manaEdHex(s.event, 3));
  });
  manaCellTriggers(E).forEach(function (t) {
    g.appendChild(svgEl('rect', { x: t.x * 16 + 1, y: t.y * 16 + 1, width: 14, height: 14, 'class': t.kind === 'exit' ? 'ed-exit' : 'ed-hit' }));
    manaLabel(g, t.x, t.y, t.kind === 'exit' ? '⇦' : '⚔' + manaEdHex(t.event, 3));
  });
  return g;
}

/** Cuttable cells: outlined with the weapons that cut them (chip on), or drawn as they are once cut (chip off). */
function manaCutOverlay(E, host) {
  var M = E.M, g = svgEl('g', { 'class': 'mm-cut', 'pointer-events': 'none' });
  ['A', 'B'].forEach(function (layer) {
    manaEachCell(E, layer, function (x, y, c) {
      var e = manaEdEffectOf(c);
      if (!e || e.kind !== 'cut') return;
      if (E.st.cut) {
        g.appendChild(svgEl('rect', { x: x * 16 + 0.5, y: y * 16 + 0.5, width: 15, height: 15, 'class': 'mc-cut' }));
        var t = svgEl('title', {});
        t.textContent = 'Cut by weapon ' + manaEdCutWeapons(e.n) + ' → metatile $' + manaEdHex(e.to, 2) + ' (layer ' + layer + ')';
        g.lastChild.appendChild(t);
      } else if (e.to < 192) {
        g.appendChild(manaTileGroup(E, x, y, layer === 'A' ? e.to : manaEdCell(M, 'A', x, y), layer === 'B' ? e.to : manaEdCell(M, 'B', x, y)));
      }
    });
  });
  host.appendChild(g);
}

var MANA_STAIRS_GLYPH = { 0x20: '≡', 0x21: '≡', 0x22: '⟋', 0x23: '⟍' };
