// Ownership: the cuttable layer — tiles drawn over the map that the player
// can cut away, and the bottom bar's `Cuttable` toggle that paints on it.
//
// A cuttable cell is a whole metatile (background + foreground + collision)
// sitting over the cell's own tile. In game, slashing it swaps in the tile
// beneath: the room's Section 4 table maps the cuttable metatile to the one
// it covers (docs/map-format/cuttable_grass_mechanics.md — cutting swaps the
// metatile id only, so collision comes from the tile beneath too). The
// encoder builds that table from this layer (maps/custom-room.ts).
//
// With the toggle on, paint and erase work on this layer; everything
// else (pick, copy, move, stamps, specials) still works on the cells.
//
// State is `_edit.cut` ("x,y" -> stamp index), written only through
// editApply with `layer: 'cut'` so it shares the one undo stack.
//
// Owns: _editCutLayer.

var _editCutLayer = false;

function editCutLayerOn() { return _editCutLayer; }

/** The bottom bar's toggle, next to Collision (map-editor-filterbar.js). */
function cutLayerButtonHtml() {
  return '<button class="rdf rdf-cut' + (_editCutLayer ? ' on' : '') + '" data-edit-act="cut-layer"'
    + ' title="' + escH('Draw on the cuttable layer: tiles the player can cut away, revealing the tile '
      + 'beneath. Off: draw the map itself.') + '">Cuttable</button>';
}

function editCutToggle() {
  _editCutLayer = !_editCutLayer;
  var btns = document.querySelectorAll('.rdf-cut');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', _editCutLayer);
  editNote(_editCutLayer
    ? 'drawing on the cuttable layer — cutting a tile reveals the one beneath'
    : 'drawing on the map');
  renderEditChrome();
}

/** The cuttable stamp at a cell, or -1. */
function editCutAt(x, y) {
  var d = editDraft();
  if (!d || !d.cut) return -1;
  var k = editKey(x, y);
  return Object.prototype.hasOwnProperty.call(d.cut, k) ? d.cut[k] : -1;
}

/**
 * What a stroke writes on the cuttable layer at one cell, or null.
 *
 * Painting composes like painting the map does (editResolve), against
 * what the brush covers there — the cuttable tile if there is one, else the
 * cell beneath — so a front tile laid on the ground makes "this ground with
 * grass on it", and cutting it leaves the ground. Erasing takes the
 * cuttable tile off whole.
 */
function editCutWrite(x, y, brush, erasing) {
  var cut = editCutAt(x, y);
  if (erasing) return cut >= 0 ? { x: x, y: y, index: null, layer: 'cut' } : null;
  if (brush < 0) return null;
  var under = cut >= 0 ? cut : editCellAt(_mtPalette, x, y);
  var idx = under >= 0 ? editResolve(_mtPalette, x, y, brush, false, under) : brush;
  return idx < 0 ? null : { x: x, y: y, index: idx, layer: 'cut' };
}

/** The layer, drawn over the cells; outlined while it is the one being edited. */
function editCutSvg(palette, composed, origin) {
  var d = editDraft();
  // Off, the map shows what it shows once cut — the tile beneath. The layer
  // is still there and still exported; turn Cuttable on to see and edit it.
  if (!d || !d.cut || !_editCutLayer) return '';
  var html = '';
  Object.keys(d.cut).forEach(function (k) {
    var p = k.split(',');
    var pos = editCellPos(origin, Number(p[0]), Number(p[1]));
    html += editStampSvg(palette, composed, d.cut[k], pos.x, pos.y, 'rg-edit-cell rg-edit-cut');
    if (_editCutLayer) {
      html += '<rect class="rg-cut-mark" x="' + pos.x + '" y="' + pos.y + '" width="' + EDIT_UNITS
        + '" height="' + EDIT_UNITS + '"><title>cuttable — cutting reveals the tile beneath</title></rect>';
    }
  });
  return html;
}

/**
 * A ROM room's own cuttable grass with the chip off: each cell as it is once
 * cut — the stamp the room's swap table puts there — so the map shows what
 * lies beneath, the way a custom map's cuttable layer does. Cells the draft
 * has changed are the draft's. In the overlay, over the canopy picture,
 * which still has the grass in it.
 */
function editRoomCutBeneathSvg(palette, composed, origin) {
  var d = editDraft();
  if (_editCutLayer || !d || !palette || !palette.cuttable || !editOnRomRoom()) return '';
  var html = '';
  palette.cuttable.forEach(function (c) {
    var k = c[0] + ',' + c[1];
    if (c[2] == null || c[2] < 0 || Object.prototype.hasOwnProperty.call(d.cells, k)
      || (d.cut && Object.prototype.hasOwnProperty.call(d.cut, k))) return;
    var at = editCellPos(origin, c[0], c[1]);
    html += editStampSvg(palette, composed, c[2], at.x, at.y, 'rg-edit-cell rg-cut-beneath');
  });
  return html;
}

/**
 * A ROM room's own cuttable grass, marked while the chip is on. It lives in
 * the room's grid and its Section 4 table, not in `_edit.cut`, and the render
 * leaves its baked outlines out while editing (romOverlayFlags). Drawn in the
 * overlay (map-editor-paint.js): the canopy picture would cover it lower down.
 */
function editRoomCutSvg(palette, origin) {
  var d = editDraft();
  if (!_editCutLayer || !d || !palette || !palette.cuttable || !editOnRomRoom()) return '';
  var html = '';
  palette.cuttable.forEach(function (c) {
    if (d.cut && Object.prototype.hasOwnProperty.call(d.cut, c[0] + ',' + c[1])) return;
    var at = editCellPos(origin, c[0], c[1]);
    html += '<rect class="rg-cut-mark rg-cut-room" x="' + at.x + '" y="' + at.y + '" width="' + EDIT_UNITS
      + '" height="' + EDIT_UNITS + '"><title>the room’s cuttable grass</title></rect>';
  });
  return html;
}

/** Export ROM's `cut`: `[x, y, l1, l2, cw]` per cuttable cell (maps/custom-room.ts). */
function editCutPayload() {
  var d = editDraft();
  if (!d || !d.cut) return [];
  var out = [];
  Object.keys(d.cut).forEach(function (k) {
    var p = k.split(',');
    var s = editStampWords(_mtPalette, d.cut[k]);
    if (s) out.push([Number(p[0]), Number(p[1]), s.layer1, s.layer2, s.collision]);
  });
  return out;
}
