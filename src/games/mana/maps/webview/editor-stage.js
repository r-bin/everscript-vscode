// Ownership: the map on screen in the Secret of Mana editor — what goes inside the shell's `#rg-svg`: the
// map's own picture, the animation, the cells the user changed or a selected state changes (redrawn from the
// metatile sheets), the grid, the overlays (drawn by editor-overlays.js; the characters and the hovered
// thing here), and the map objects' marks. One map, one SVG with the Evermore editor's units (the viewBox is in
// 8 px units, a cell is 2), so the shell's zoom and pan — and the object marks' shared CSS, which is written
// in those units — work on it unchanged. The pixel-sized content sits in `#rg-px`, scaled by 1/8.
// State lives on the editor instance `E` (editor.js); nothing is owned here.
//
// Changed cells: a cell is redrawn only while it differs from how the map opened (editor-model.js
// manaEdCellChanged). It is the backdrop colour, layer B's metatile, then layer A's, each cropped out of its
// sheet by a nested <svg viewBox>. BG priority and colour math are not applied: they need the whole screen.

/** One viewBox unit is 8 px, as in the Evermore editor; a cell is `CELL` units. */
var MANA_UNIT = 8, MANA_CELL = 2;

/** The svg's contents (inner markup), before the page is wired. */
function manaStageInner(E) {
  var W = E.W, H = E.HPX;
  return '<g id="rg-px" transform="scale(0.125)"><image class="room-img mm-picture" id="rg-img" x="0" y="0" width="' + W + '" height="' + H
    + '" preserveAspectRatio="none" href="' + manaPictureHref(E) + '"/>'
    + '<g id="rg-edit-tiles"></g><g id="rg-grid" pointer-events="none"></g><g id="rg-over"></g>'
    + '<rect id="rg-hover" class="mana-hover" x="0" y="0" width="16" height="16" display="none" pointer-events="none"/></g>'
    + '<g id="rg-marks" pointer-events="none"></g>';
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
  manaStageMarks(E);
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
    // Into the pixel group, right after the picture: the changed cells and overlays stay on top of it.
    E.player = playAnimation(document.getElementById('rg-px'), a);
  });
}

/** The picture follows the BG1 / BG2 chips; the changed cells and the animation follow it. */
function manaStageLayers(E) {
  var img = document.getElementById('rg-img');
  if (img) img.setAttribute('href', manaPictureHref(E));
  manaStageAnimate(E);
  manaStageEdits(E, null);
}

/** A cell drawn from the sheets: the backdrop, then layer B's metatile `b`, then A's `a` (px coordinates). */
function manaTileGroup(E, x, y, a, b) {
  var M = E.M, g = svgEl('g', { 'data-cell': x + ',' + y });
  g.appendChild(svgEl('rect', { x: x * 16, y: y * 16, width: 16, height: 16, fill: 'rgb(' + M.backdrop.join(',') + ')' }));
  [['B', b, E.st.b], ['A', a, E.st.a]].forEach(function (l) {
    var layer = l[0], n = l[1];
    if (!l[2] || n < 0 || n > 191) return;
    var cell = svgEl('svg', { x: x * 16, y: y * 16, width: 16, height: 16,
      viewBox: ((n % 16) * 16) + ' ' + (Math.floor(n / 16) * 16) + ' 16 16', overflow: 'hidden' });
    cell.appendChild(svgEl('image', { x: 0, y: 0, width: 256, height: 192, href: E.ctx.somBase + 'maps/' + E.entry.hex + '.tiles.' + layer.toLowerCase() + '.png' }));
    g.appendChild(cell);
  });
  return g;
}

/** One changed cell: what shows there now (painted, or a selected state's, or the map's own). */
function manaCellGroup(E, x, y) {
  return manaTileGroup(E, x, y, manaEdCell(E.M, 'A', x, y), manaEdCell(E.M, 'B', x, y));
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

/**
 * The overlays over the map (in the pixel group): the cut layer, collision, specials, triggers, characters.
 * A tab that edits an overlay shows it while it is open (manaForcedChip): there is nothing to edit under a hidden one.
 */
function manaStageOverlays(E) {
  var host = document.getElementById('rg-over');
  if (!host) return;
  host.textContent = '';
  manaCutOverlay(E, host);
  if (manaChipOn(E, 'collision')) manaCollisionOverlay(E, host);
  if (manaChipOn(E, 'specials')) manaSpecialsOverlay(E, host);
  if (manaChipOn(E, 'triggers')) host.appendChild(manaTriggersGroup(E));
  if (manaChipOn(E, 'characters')) host.appendChild(manaCharactersGroup(E));
  manaStageMarks(E);
}

/**
 * The character records, the only things drawn as circles. Records on one cell (the game spawns what their flags
 * allow, so these look like variants of one character) are one ring labelled with their count.
 */
function manaCharactersGroup(E) {
  var g = svgEl('g', { 'class': 'ed-objects', 'pointer-events': 'none' }), seen = {};
  E.M.objects.forEach(function (o, i) {
    var key = o.x + ',' + o.y;
    if (seen[key]) return;
    seen[key] = true;
    var here = manaEdObjectsAt(E.M, o.x, o.y), sel = here.indexOf(E.S.sel.obj) >= 0;
    g.appendChild(svgEl('circle', { cx: o.x * 16 + 8, cy: o.y * 16 + 8, r: 6, 'class': 'mo-ring' + (sel ? ' sel' : '') }));
    var t = svgEl('text', { x: o.x * 16 + 8, y: o.y * 16 - 1, 'class': 'mo-label' });
    t.textContent = here.length > 1 ? '×' + here.length : manaEdHex(o.kind, 4);
    g.appendChild(t);
  });
  return g;
}

/**
 * The map objects' marks, drawn like the Evermore editor's objects (same classes, same units: map-editor-objects.js
 * editObjectSvg): the area's dashed box with its number, where each state draws, the open state's frame.
 */
function manaStageMarks(E) {
  var host = document.getElementById('rg-marks'), st = E.st, M = E.M;
  if (!host) return;
  host.textContent = '';
  if (!manaChipOn(E, 'objects')) return;
  var C = MANA_CELL, html = '';
  M.pieces.forEach(function (p, i) {
    var sel = E.S.sel.piece === i, active = M.pieceState[i] || 0;
    html += '<rect class="rg-obj-area rg-obj-cluster' + (sel ? ' sel' : '') + '" x="' + (p.x * C) + '" y="' + (p.y * C)
      + '" width="' + (p.w * C) + '" height="' + (p.h * C) + '" pointer-events="none"><title>' + shellEscape('object ' + i + ': flag $'
      + manaEdHex(p.flag, 2) + ', ' + p.w + '×' + p.h + ' at ' + p.x + ',' + p.y) + '</title></rect>'
      + '<text class="rg-corner-lbl rg-obj-id" x="' + ((p.x + p.w) * C - C * 0.12) + '" y="' + (p.y * C + C * 0.3)
      + '" font-size="' + (C * 0.22) + '" text-anchor="end" pointer-events="none">' + i + '</text>';
    p.frames.forEach(function (f, fi) {
      var b = manaEdFrameBounds(p, fi + 1);
      if (!b) return;
      html += '<rect class="rg-obj-subframe" x="' + ((p.x + b.dx) * C) + '" y="' + ((p.y + b.dy) * C) + '" width="' + (b.w * C)
        + '" height="' + (b.h * C) + '" pointer-events="none"><title>' + shellEscape('object ' + i + ' state ' + (fi + 1) + ': ' + b.w + '×' + b.h
        + ' (' + b.count + ' cells)') + '</title></rect>';
    });
    if (sel && active >= 1) {
      var ab = manaEdFrameBounds(p, active);
      if (ab) html += '<rect class="rg-obj-frame" x="' + ((p.x + ab.dx) * C) + '" y="' + ((p.y + ab.dy) * C) + '" width="' + (ab.w * C)
        + '" height="' + (ab.h * C) + '" pointer-events="none"><title>' + shellEscape('state ' + active + ': ' + ab.w + '×' + ab.h + ' (' + ab.count + ' cells)') + '</title></rect>';
    }
  });
  host.innerHTML = html;
}

/** Coalesce overlay redraws while a stroke runs (a 120x120 map builds a long path). */
function manaStageOverlaysSoon(E) {
  if (E.raf) return;
  E.raf = requestAnimationFrame(function () { E.raf = 0; if (!E.closed) manaStageOverlays(E); });
}

/** The map cell under mouse event `e` ({x, y, q}), or null outside the map. */
function manaCellAt(E, e) {
  var svg = E.svg;
  if (!svg || !svg.getScreenCTM) return null;
  var pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  var p = pt.matrixTransform(svg.getScreenCTM().inverse());
  var x = Math.floor(p.x / MANA_CELL), y = Math.floor(p.y / MANA_CELL);   // viewBox units: a cell is 2
  if (x < 0 || y < 0 || x >= E.M.w || y >= E.M.h) return null;
  // q: the 8 px quarter under the pointer (1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right).
  return { x: x, y: y, q: (p.x - x * MANA_CELL >= MANA_CELL / 2 ? 2 : 1) * (p.y - y * MANA_CELL >= MANA_CELL / 2 ? 4 : 1) };
}

/** Light the cell under the pointer. */
function manaHover(E, c) {
  var r = document.getElementById('rg-hover');
  if (!r) return;
  if (!c) { r.setAttribute('display', 'none'); return; }
  r.setAttribute('x', c.x * 16); r.setAttribute('y', c.y * 16); r.removeAttribute('display');
}
