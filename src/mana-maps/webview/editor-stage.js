// Ownership: the map on screen in the Secret of Mana editor — what goes inside the shell's `#rg-svg`: the
// map's own picture, the animation, the cells the user changed (redrawn from the metatile sheets), the grid
// and the overlays (collision, specials, step events, objects, the hovered and selected thing). One map,
// one SVG, in pixel units (16 per cell), so the shell's zoom and pan work on it unchanged.
// State lives on the editor instance `E` (editor.js); nothing is owned here.
//
// Changed cells: a cell is redrawn only while it differs from how the map opened (editor-model.js
// manaEdCellChanged). It is the backdrop colour, layer B's metatile, then layer A's, each cropped out of its
// sheet by a nested <svg viewBox>. BG priority and colour math are not applied: they need the whole screen.

/** The svg's contents (inner markup), before the page is wired. */
function manaStageInner(E) {
  var W = E.W, H = E.HPX;
  return '<image class="room-img mm-picture" id="rg-img" x="0" y="0" width="' + W + '" height="' + H
    + '" preserveAspectRatio="none" href="' + manaPictureHref(E) + '"/>'
    + '<g id="rg-edit-tiles"></g><g id="rg-grid" pointer-events="none"></g><g id="rg-over"></g>'
    + '<rect id="rg-hover" class="mana-hover" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/>';
}

function manaPictureHref(E) {
  return mapPictureUrl(E.ctx.somBase, E.entry.hex, { a: E.st.a, b: E.st.b });
}

/** After the shell page is built: animation, changed cells, grid, overlays. */
function manaStageStart(E) {
  E.svg = document.getElementById('rg-svg');
  manaStageAnimate(E);
  manaStageEdits(E, null);
  manaStageGrid(E);
  manaStageOverlays(E);
}

function manaStageStop(E) {
  if (E.player) { E.player.stop(); E.player = null; }
}

function manaStageAnimate(E) {
  manaStageStop(E);
  if (!E.st.animate || !E.st.a || !E.st.b) return;
  E.ctx.readJson('maps/' + E.entry.hex + '.anim.json', function (a) {
    if (E.closed || !E.svg || !E.svg.isConnected) return;
    manaStageStop(E);
    E.player = playAnimation(E.svg, a);
  });
}

/** The picture follows the BG1 / BG2 chips; the changed cells and the animation follow it. */
function manaStageLayers(E) {
  var img = document.getElementById('rg-img');
  if (img) img.setAttribute('href', manaPictureHref(E));
  manaStageAnimate(E);
  manaStageEdits(E, null);
}

/** One changed cell's markup: backdrop, then layer B's metatile, then A's. */
function manaCellGroup(E, x, y) {
  var M = E.M, g = svgEl('g', { 'data-cell': x + ',' + y });
  g.appendChild(svgEl('rect', { x: x * 16, y: y * 16, width: 16, height: 16, fill: 'rgb(' + M.backdrop.join(',') + ')' }));
  [['B', E.st.b], ['A', E.st.a]].forEach(function (l) {
    var layer = l[0], n = manaEdCell(M, layer, x, y);
    if (!l[1] || n < 0 || n > 191) return;
    var cell = svgEl('svg', { x: x * 16, y: y * 16, width: 16, height: 16,
      viewBox: ((n % 16) * 16) + ' ' + (Math.floor(n / 16) * 16) + ' 16 16', overflow: 'hidden' });
    cell.appendChild(svgEl('image', { x: 0, y: 0, width: 256, height: 192, href: E.ctx.somBase + 'maps/' + E.entry.hex + '.tiles.' + layer.toLowerCase() + '.png' }));
    g.appendChild(cell);
  });
  return g;
}

/** Redraw the changed cells: `cells` ([{x, y}]) or null for every cell. */
function manaStageEdits(E, cells) {
  var host = document.getElementById('rg-edit-tiles'), M = E.M;
  if (!host) return;
  var one = function (x, y) {
    var old = host.querySelector('[data-cell="' + x + ',' + y + '"]');
    if (old) old.remove();
    if (manaEdCellChanged(M, x, y)) host.appendChild(manaCellGroup(E, x, y));
  };
  if (cells) { cells.forEach(function (c) { one(c.x, c.y); }); return; }
  host.textContent = '';
  for (var y = 0; y < M.h; y++) for (var x = 0; x < M.w; x++) if (manaEdCellChanged(M, x, y)) host.appendChild(manaCellGroup(E, x, y));
}

/** The 16 px grid, like Evermore's coarse grid (rg-grid-coarse). */
function manaStageGrid(E) {
  var host = document.getElementById('rg-grid');
  if (!host) return;
  host.textContent = '';
  if (!E.st.grid) return;
  var d = '', W = E.W, H = E.HPX;
  for (var gx = 0; gx <= W; gx += 16) d += 'M' + gx + ' 0V' + H;
  for (var gy = 0; gy <= H; gy += 16) d += 'M0 ' + gy + 'H' + W;
  host.appendChild(svgEl('path', { 'class': 'rg-grid-coarse', d: d, fill: 'none', stroke: 'rgba(160,140,80,0.42)', 'stroke-width': 0.6 }));
}

/** Collision, specials, step events and objects over the map. */
function manaStageOverlays(E) {
  var host = document.getElementById('rg-over'), st = E.st, M = E.M;
  if (!host) return;
  host.textContent = '';
  if (st.collision || st.specials) {
    var c = manaEdCollisionView(M);
    if (st.collision) drawCollision(host, c);
    if (st.specials) drawSpecials(host, c);
  }
  // What the open tab edits is always shown: there is nothing to edit under a hidden overlay.
  if (st.triggers || st.tab === 'trigger') host.appendChild(manaTriggersGroup(E));
  if (st.objects || st.tab === 'object') host.appendChild(manaObjectsGroup(E));
}

function manaTriggersGroup(E) {
  var g = svgEl('g', { 'class': 'ed-triggers', 'pointer-events': 'none' });
  E.M.steps.forEach(function (s, i) {
    g.appendChild(svgEl('rect', { x: s.x * 16 + 1, y: s.y * 16 + 1, width: 14, height: 14, 'class': 'ed-trig' + (E.S.sel.step === i ? ' sel' : '') }));
    var t = svgEl('text', { x: s.x * 16 + 8, y: s.y * 16 + 11, 'class': 'ms-label' });
    t.textContent = manaEdHex(s.event, 3);
    g.appendChild(t);
  });
  return g;
}

function manaObjectsGroup(E) {
  var g = svgEl('g', { 'class': 'ed-objects', 'pointer-events': 'none' });
  E.M.objects.forEach(function (o, i) {
    g.appendChild(svgEl('circle', { cx: o.x * 16 + 8, cy: o.y * 16 + 8, r: 6, 'class': 'mo-ring' + (E.S.sel.obj === i ? ' sel' : '') }));
    var t = svgEl('text', { x: o.x * 16 + 8, y: o.y * 16 - 1, 'class': 'mo-label' });
    t.textContent = manaEdHex(o.kind, 4);
    g.appendChild(t);
  });
  return g;
}

/** Coalesce overlay redraws while a stroke runs (a 120x120 map builds a long path). */
function manaStageOverlaysSoon(E) {
  if (E.raf) return;
  E.raf = requestAnimationFrame(function () { E.raf = 0; if (!E.closed) manaStageOverlays(E); });
}

/** The map cell under mouse event `e`, or null outside the map. */
function manaCellAt(E, e) {
  var svg = E.svg;
  if (!svg || !svg.getScreenCTM) return null;
  var pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  var p = pt.matrixTransform(svg.getScreenCTM().inverse());
  var x = Math.floor(p.x / 16), y = Math.floor(p.y / 16);
  return x < 0 || y < 0 || x >= E.M.w || y >= E.M.h ? null : { x: x, y: y };
}

/** Light the cell under the pointer. */
function manaHover(E, c) {
  var r = document.getElementById('rg-hover');
  if (!r) return;
  if (!c) { r.setAttribute('display', 'none'); return; }
  r.setAttribute('x', c.x * 16); r.setAttribute('y', c.y * 16); r.removeAttribute('display');
}
