// Ownership: drawing the draft onto the map, and the mouse gestures that
// produce it. State lives in map-editor.js; markup lives in
// map-editor-ui.js.
//
// An edited cell is drawn client-side from the palette atlas the tab has
// already loaded — a nested <svg> whose viewBox crops one 16x16 stamp out
// of the sheet. So a stroke is instant and costs no round trip; the host is
// only involved when a *new* stamp needs rendering.
//
// Owns: _editSel (the rectangle gesture in progress) and _editClip (the
// copied region).

var _editSel = null;
var _editClip = null;

/** A metatile is 16 px; the map's SVG grid is one unit per 8 px. */
var EDIT_UNITS = 2;

/** Map units for the top-left of metatile cell (tx, ty). */
function editCellPos(origin, tx, ty) {
  return { x: origin.x + tx * EDIT_UNITS, y: origin.y + ty * EDIT_UNITS };
}

/**
 * One stamp, cropped out of whichever atlas holds it.
 *
 * Indices below the room's own count come from the palette sheet; the rest
 * are composed stamps and come from the preview sheet the host rendered for
 * the draft.
 */
function editStampSvg(palette, composed, index, x, y, cls) {
  var sheet = palette;
  var i = index;
  if (palette && index >= palette.count) {
    sheet = composed;
    i = index - palette.count;
  }
  if (!sheet || !sheet.imageUri || i < 0 || i >= sheet.count) return '';
  var cx = (i % sheet.columns) * sheet.cell;
  var cy = Math.floor(i / sheet.columns) * sheet.cell;
  return '<svg class="' + cls + '" x="' + x + '" y="' + y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS
    + '" viewBox="' + cx + ' ' + cy + ' ' + sheet.cell + ' ' + sheet.cell + '">'
    + '<image href="' + sheet.imageUri + '" width="' + sheet.imageWidth + '" height="' + sheet.imageHeight
    + '" style="image-rendering:pixelated"/></svg>';
}

/**
 * Rebuild the edit layer: every painted cell, plus the selection outline.
 *
 * Inserted directly above the map image and below everything else, because
 * an edit replaces map pixels — it is scenery, not annotation, and the
 * canopy and the overlay still belong on top of it.
 */
function renderEditLayer(palette, composed, origin) {
  var svg = document.getElementById('rg-svg');
  var img = document.getElementById('rg-img');
  if (!svg || !img) return;
  var g = document.getElementById('rg-edit');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'rg-edit');
    g.setAttribute('pointer-events', 'none');
    img.parentNode.insertBefore(g, img.nextSibling);
  }
  var d = editDraft();
  if (!d) { g.innerHTML = ''; return; }

  var html = '';
  Object.keys(d.cells).forEach(function (k) {
    var p = k.split(',');
    var pos = editCellPos(origin, Number(p[0]), Number(p[1]));
    html += editStampSvg(palette, composed, d.cells[k], pos.x, pos.y, 'rg-edit-cell');
  });
  // Special glyphs (stairs/drift, gate, entrance) sit on their own key
  // space (see map-editor.js's specialCells), so they are drawn in their
  // own pass rather than folded into the cell loop above — a cell can be
  // painted with a tile, a special, both, or neither. Non-blocking of the
  // base tile colour, per the design mock.
  Object.keys(d.specialCells || {}).forEach(function (k) {
    var p = k.split(',');
    var pos = editCellPos(origin, Number(p[0]), Number(p[1]));
    html += editSpecialGlyphSvg(d.specialCells[k], pos.x, pos.y);
  });
  // The Boy's start, over the tiles and glyphs — map-editor-start.js.
  html += editStartSvg(origin);
  // The Select tool's own outlines: the selected trigger, and a live preview
  // of where a drag would land it — see map-editor-trigger-select.js.
  if (d.selectedTriggerRef) {
    var selTrig = editTriggerFind(d.selectedTriggerRef);
    if (selTrig) html += triggerOutlineSvg(selTrig, d.selectedTriggerRef.kind, origin, 'rg-trigger-sel');
  }
  if (_triggerDrag) {
    html += triggerOutlineSvg({
      x1: _triggerDrag.x, y1: _triggerDrag.y,
      x2: _triggerDrag.x + _triggerDrag.w - 1, y2: _triggerDrag.y + _triggerDrag.h - 1,
    }, _triggerDrag.ref.kind, origin, 'rg-trigger-drag');
  }
  if (_editSel) {
    var a = editCellPos(origin, _editSel.x1, _editSel.y1);
    html += '<rect class="rg-edit-sel" x="' + a.x + '" y="' + a.y
      + '" width="' + ((_editSel.x2 - _editSel.x1 + 1) * EDIT_UNITS)
      + '" height="' + ((_editSel.y2 - _editSel.y1 + 1) * EDIT_UNITS) + '"/>';
  }
  g.innerHTML = html;
}

/**
 * A selection/drag outline for a trigger box, in the accent colour of its
 * kind (step ~ pink, B ~ yellow — `--rg-trigger-step`/`--rg-trigger-b`,
 * reserved in map-editor-theme.css since Phase 1 for exactly this).
 */
function triggerOutlineSvg(box, kind, origin, cls) {
  var a = editCellPos(origin, box.x1, box.y1);
  return '<rect class="' + cls + ' ' + cls + '-' + kind + '" x="' + a.x + '" y="' + a.y
    + '" width="' + ((box.x2 - box.x1 + 1) * EDIT_UNITS)
    + '" height="' + ((box.y2 - box.y1 + 1) * EDIT_UNITS) + '"/>';
}

/** What is in a cell right now: the draft first, then the room's own grid. */
function editCellAt(palette, tx, ty) {
  var d = editDraft();
  if (d) {
    var k = editKey(tx, ty);
    if (Object.prototype.hasOwnProperty.call(d.cells, k)) return d.cells[k];
  }
  if (!palette || !palette.grid) return -1;
  var row = palette.grid[ty];
  return row && row[tx] != null ? row[tx] : -1;
}

function editInBounds(palette, tx, ty) {
  return palette && tx >= 0 && ty >= 0 && tx < palette.widthTiles && ty < palette.heightTiles;
}

/**
 * Fill a rectangle with the brush.
 *
 * Through the brush **resolved against each cell** (map-editor-phases.js's
 * `editResolve`), not written raw. Writing `index` straight in was a real
 * bug: a front-composed brush is `{layer1: art, layer2: blank}`, so a rect
 * (or a `move`'s backfill, which shares this function) laid the art down
 * *and blanked the terrain under it* — the drag did not honour the
 * foreground/background distinction that the same brush honours perfectly
 * under the paint tool, which has always gone through `editResolve`. One
 * owner decides what a stroke writes; two tools must not answer differently
 * for the same brush.
 */
function editRectWrites(x1, y1, x2, y2, index, palette) {
  var w = [];
  for (var y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    for (var x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (!editInBounds(palette, x, y)) continue;
      var at = editResolve(palette, x, y, index, false);
      if (at >= 0) w.push({ x: x, y: y, index: at });
    }
  }
  return w;
}

/** Stamp the copied region with its top-left at (tx, ty). */
function editPasteWrites(tx, ty, palette) {
  if (!_editClip) return [];
  var w = [];
  for (var dy = 0; dy < _editClip.h; dy++) {
    for (var dx = 0; dx < _editClip.w; dx++) {
      var v = _editClip.cells[dy * _editClip.w + dx];
      if (v < 0 || !editInBounds(palette, tx + dx, ty + dy)) continue;
      w.push({ x: tx + dx, y: ty + dy, index: v });
    }
  }
  return w;
}

/**
 * Take the selected rectangle into the clipboard.
 *
 * `move` also backfills the source with the current brush, because the
 * format has no concept of an empty cell — every cell holds some metatile,
 * so "move this window" has to say what is left behind.
 */
function editTakeSelection(palette, move) {
  if (!_editSel) return [];
  var w = _editSel.x2 - _editSel.x1 + 1;
  var h = _editSel.y2 - _editSel.y1 + 1;
  var cells = [];
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) cells.push(editCellAt(palette, _editSel.x1 + x, _editSel.y1 + y));
  }
  _editClip = { w: w, h: h, cells: cells };
  var d = editDraft();
  if (!move || !d || d.brush < 0) return [];
  return editRectWrites(_editSel.x1, _editSel.y1, _editSel.x2, _editSel.y2, d.brush, palette);
}
