// Ownership: animated tiles on the map — the purple marks (a border and the
// pattern letter on every cell showing one), the frames of an unfinished one
// drawn over its cells, the Tile tab's pencil tiling those frames, and the
// filter bar's `Animation` chip that shows or hides the marks. The model is
// map-editor-animations.js; the tab is map-editor-anim-tab.js.
//
// An unfinished animated tile is not on the canvas yet as frames — its cells
// show frame 0, the slot's own graphic. So the frame being looked at is drawn
// here, over the cell and its canopy, as the cuttable layer is: a tiled frame
// as its graphic, an empty one as a purple box. One graphic, no front/ground.
//
// Owns: _animMarks, _animTileTouch.

/** The filter bar's `Animation` chip: borders and letters on the map (saved). */
var _animMarks = true;
/** uid -> the frame a Tile-tab stroke tiles in it, so a drag does not run on into the next frame. */
var _animTileTouch = {};

function animMarksButtonHtml() {
  return '<button class="rdf rdf-anim-marks' + (_animMarks ? ' on' : '') + '" data-edit-act="anim-marks" title="'
    + escH('Animated tiles: a purple border and the pattern letter on every cell showing one') + '">Animation</button>';
}

function editAnimMarksToggle() {
  _animMarks = !_animMarks;
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: 'animMarks', value: _animMarks });
  var btns = document.querySelectorAll('.rdf-anim-marks');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', _animMarks);
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** The frame of an unfinished tile the map shows: the open frame while it is open and paused, else 0. */
function animUnfinishedFrame(e) {
  return !_animOff && !_animPlaying && e.uid === _animSel ? _animFrame : 0;
}

/** One graphic from its family's sheet at (x, y), mirrored as its word says. */
function animGraphicSvg(graphic, family, word, x, y) {
  var at = animSheetAt(graphic, family);
  if (!at) return '';
  var s = at.s, u = EDIT_UNITS, h = word & 0x4000, v = word & 0x8000;
  var flip = h || v ? ' transform="translate(' + (x + (h ? u : 0)) + ' ' + (y + (v ? u : 0)) + ') scale(' + (h ? -1 : 1) + ' ' + (v ? -1 : 1)
    + ') translate(' + -x + ' ' + -y + ')"' : '';
  return '<g' + flip + '><rect class="rg-anim-backing" x="' + x + '" y="' + y + '" width="' + u + '" height="' + u + '"/>'
    + '<svg x="' + x + '" y="' + y + '" width="' + u + '" height="' + u + '" viewBox="' + at.x + ' ' + at.y + ' ' + s.cell + ' ' + s.cell
    + '"><image href="' + s.imageUri + '" width="' + s.imageWidth + '" height="' + s.imageHeight + '" style="image-rendering:pixelated"/></svg></g>';
}

/** Under a front (canopy) frame: the cell's ground, so frame 0 does not show through it. */
function animUnderSvg(e, c, a) {
  if (e.layer !== 'canopy') return '';
  var p = _mtPalette, w = editStampWords(p, editCellAt(p, c[0], c[1])), pal = w ? (w.layer2 >> 10) & 7 : 0;
  var g = pal ? editSlotGraphicId(p, animWordSlot(w.layer2)) : null;
  return g == null ? '' : animGraphicSvg(g, editFamilies()[pal - 1], w.layer2, a.x, a.y);
}

/**
 * Purple on the map, in the overlay (over the canopy). An unfinished tile's
 * shown frame: its graphic, or a purple box while it has none. With the chip
 * on, or on the Animation tab: every animated cell's border and its pattern
 * letter (`*` for its own ticks), the open one brighter.
 */
function editAnimSvg(origin) {
  var p = _mtPalette;
  if (!p || !editAnims().length) return '';
  var onTab = typeof _editActiveTab !== 'undefined' && _editActiveTab === 'anim';
  var marks = _animMarks || onTab, html = '';
  editAnimsListed(p).forEach(function (entry) {
    var e = entry.g, done = editAnimComplete(e);
    var k = done ? -1 : animUnfinishedFrame(e), g = k >= 0 ? e.frames[k] : null;
    var fam = !done && g != null && k > 0 ? animFamilyOf(e, entry.cells) : null;
    var letter = done && marks ? (editAnimLetter(e) || '*') : '';
    var cls = 'rg-anim-cell' + (!done && g == null ? ' empty' : '') + (e.uid === _animSel ? ' sel' : '');
    entry.cells.forEach(function (key) {
      var c = key.split(',').map(Number), a = editCellPos(origin, c[0], c[1]);
      if (fam != null) html += animUnderSvg(e, c, a) + animGraphicSvg(g, fam, e.pal || 0, a.x, a.y);
      if (!marks && done) return;
      if (marks || g == null) {
        html += '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS + '" pointer-events="none"/>';
      }
      if (letter) html += editCornerLabelSvg(a, [[letter, 'rg-anim-lbl']]);
    });
  });
  return html;
}

/**
 * The Tile tab's pencil on a cell of an unfinished animated tile: the tile
 * goes into a frame — the open one while it is open, else its first empty
 * one — not into the map beneath it. Returns true when it took the stroke.
 */
function editAnimTileStroke(d, cell, phase) {
  if (phase === 'down') _animTileTouch = {};
  var e = animAt(cell);
  if (!e || editAnimComplete(e) || e.vanilla) return false;
  var k = _animTileTouch[e.uid];
  if (k == null) k = e.uid === _animSel && _animFrame < e.frames.length ? _animFrame : e.frames.indexOf(null);
  if (k < 0) return false;
  _animTileTouch[e.uid] = k;
  animTile(e, k);
  if (phase === 'down') editNote('frame ' + k + ' of the animated tile tiled — ' + e.frames.filter(function (f) { return f != null; }).length + '/' + e.frames.length);
  requestComposedPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  return true;
}
