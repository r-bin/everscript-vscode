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
 * on, or on the Animation tab: each row's cells outlined as one shape (a
 * group of touching tiles on one pattern is one), its pattern letter once
 * (`*` for its own ticks), a dotted bounding box when the shape is not a
 * rectangle, the open one brighter.
 */
function editAnimSvg(origin) {
  var p = _mtPalette;
  if (!p || (!editAnims().length && !(typeof _animStroke !== 'undefined' && _animStroke))) return '';
  var onTab = typeof _editActiveTab !== 'undefined' && _editActiveTab === 'anim';
  var marks = _animMarks || onTab, html = '';
  editAnimsListed(p).forEach(function (entry) {
    var sel = entry.members.some(function (m) { return m.uid === _animSel; });
    var letter = marks && editAnimSetComplete(entry.g, entry.members) ? (editAnimLetter(entry.g) || '*') : '';
    if (marks) html += animShapeSvg(origin, entry.cells, sel, letter);
    entry.cells.forEach(function (key) {
      // Each cell's own tile: a set's cells are each their own.
      var e = entry.of[key] || entry.g, done = editAnimComplete(e);
      var k = done ? -1 : animUnfinishedFrame(e), g = k >= 0 ? e.frames[k] : null;
      var fam = !done && g != null && k > 0 ? animFamilyOf(e, [key]) : null;
      var cls = 'rg-anim-cell' + (!done && g == null ? ' empty' : '') + (sel ? ' sel' : '');
      var c = key.split(',').map(Number), a = editCellPos(origin, c[0], c[1]);
      if (fam != null) html += animUnderSvg(e, c, a) + animGraphicSvg(g, fam, e.pal || 0, a.x, a.y);
      if (g == null && !done) {
        html += '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS + '" pointer-events="none"/>';
      }
    });
  });
  // A new rectangle being dragged out (map-editor-anim-tab.js).
  var r = typeof _animStroke !== 'undefined' && _animStroke && _animStroke.mode === 'rect' ? _animStroke : null;
  if (r) {
    var b = editCellPos(origin, Math.min(r.x0, r.x1), Math.min(r.y0, r.y1));
    html += '<rect class="rg-anim-cell empty" x="' + b.x + '" y="' + b.y + '" width="' + (Math.abs(r.x1 - r.x0) + 1) * EDIT_UNITS
      + '" height="' + (Math.abs(r.y1 - r.y0) + 1) * EDIT_UNITS + '" pointer-events="none"/>';
  }
  return html;
}

/** One row's cells as one outline (edges with no neighbour of its own), its letter in the first cell, a dotted box round an odd shape. */
function animShapeSvg(origin, cells, sel, letter) {
  if (!cells.length) return '';
  var has = {}, u = EDIT_UNITS, path = '', fill = '';
  cells.forEach(function (k) { has[k] = true; });
  var xy = cells.map(function (k) { return k.split(',').map(Number); });
  xy.forEach(function (c) {
    var a = editCellPos(origin, c[0], c[1]);
    if (sel) fill += 'M' + a.x + ' ' + a.y + 'h' + u + 'v' + u + 'h' + -u + 'z';
    if (!has[c[0] + ',' + (c[1] - 1)]) path += 'M' + a.x + ' ' + a.y + 'h' + u;
    if (!has[c[0] + ',' + (c[1] + 1)]) path += 'M' + a.x + ' ' + (a.y + u) + 'h' + u;
    if (!has[(c[0] - 1) + ',' + c[1]]) path += 'M' + a.x + ' ' + a.y + 'v' + u;
    if (!has[(c[0] + 1) + ',' + c[1]]) path += 'M' + (a.x + u) + ' ' + a.y + 'v' + u;
  });
  var xs = xy.map(function (c) { return c[0]; }), ys = xy.map(function (c) { return c[1]; });
  var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys);
  var html = (fill ? '<path class="rg-anim-shape-fill" d="' + fill + '"/>' : '') + '<path class="rg-anim-shape' + (sel ? ' sel' : '') + '" d="' + path + '"/>';
  if (cells.length !== (x1 - x0 + 1) * (y1 - y0 + 1)) {
    var b = editCellPos(origin, x0, y0);
    html += '<rect class="rg-anim-bbox" x="' + b.x + '" y="' + b.y + '" width="' + (x1 - x0 + 1) * u + '" height="' + (y1 - y0 + 1) * u + '"/>';
  }
  // The letter in the top row's first cell.
  var first = xy.filter(function (c) { return c[1] === y0; }).sort(function (a, b) { return a[0] - b[0]; })[0];
  if (letter) html += editCornerLabelSvg(editCellPos(origin, first[0], first[1]), [[letter, 'rg-anim-lbl']]);
  return '<g pointer-events="none">' + html + '</g>';
}

/**
 * The Tile tab's pencil on a cell of an unfinished animated tile: the tile
 * goes into a frame — the open one while it is open, else its first empty
 * one — not into the map beneath it. Returns true when it took the stroke.
 */
function editAnimTileStroke(d, cell, phase) {
  if (phase === 'down') _animTileTouch = {};
  // A stroke begun on an animated tile is its own to the end: it never runs on into the map beneath.
  var owned = phase !== 'down' && _animTileTouch.owned;
  var e = animAt(cell);
  if (!e || editAnimComplete(e) || e.vanilla) return !!owned;
  var k = _animTileTouch[e.uid];
  var inOpen = editAnimGroup(editAnimFind(_animSel)).indexOf(e) >= 0;
  if (k == null) k = inOpen && _animFrame < e.frames.length ? _animFrame : e.frames.indexOf(null);
  if (k < 0) return !!owned;
  _animTileTouch[e.uid] = k;
  _animTileTouch.owned = true;
  animTile(e, k);
  if (phase === 'down') editNote('frame ' + k + ' of the animated tile tiled — ' + e.frames.filter(function (f) { return f != null; }).length + '/' + e.frames.length);
  requestComposedPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  return true;
}

/**
 * A frame's swatch: from its family's sheet, else as the map renders frame
 * `k` on the first cell showing the tile (the host's frame sheets) — a frame
 * vanilla draws in another family than its cell's is not on that sheet.
 */
function animFrameSwatchHtml(graphic, family, cells, k) {
  if (graphic == null || animSheetAt(graphic, family)) return animSwatchHtml(graphic, family, 30);
  return animStampFrameSvg(cells, k, 30) || animSwatchHtml(graphic, family, 30);
}

function animStampFrameSvg(cells, k, size) {
  var p = _mtPalette, c = cells && cells[0] ? cells[0].split(',').map(Number) : null;
  var idx = c ? editCellAt(p, c[0], c[1]) : -1;
  if (idx < 0) return '';
  var sheet = idx >= p.count ? _editComposed : p, i = idx >= p.count ? idx - p.count : idx;
  var hit = sheet ? editStampAnimOf(sheet, i) : null;
  var src = k === 0 ? sheet : hit && sheet.anim.sheets[k - 1];
  if (!src || !src.imageUri) return '';
  return '<svg class="rg-anim-sw" width="' + size + '" height="' + size + '" viewBox="0 0 ' + EDIT_UNITS + ' ' + EDIT_UNITS + '">'
    + editCropSvg('rg-anim-prev-cell', 0, 0, k === 0 ? sheet : sheet.anim, src.imageUri, src.imageWidth, src.imageHeight, k === 0 ? i : hit.row, '') + '</svg>';
}

/** A graphic's swatch from its family's sheet (map-editor-families.js), or a purple empty frame. */
function animSwatchHtml(graphic, family, size) {
  var box = '<i class="rg-anim-sw' + (graphic == null ? ' empty' : '') + '" style="width:' + size + 'px;height:' + size + 'px"';
  if (graphic == null) return box + ' title="no tile yet — tile it with the pencil"></i>';
  var at = animSheetAt(graphic, family);
  if (!at) return box + ' title="graphic ' + graphic + '"></i>';
  var s = at.s, k = size / s.cell;
  return '<i class="rg-anim-sw" title="graphic ' + graphic + '" style="width:' + size + 'px;height:' + size + 'px;background-image:url('
    + s.imageUri + ');background-size:' + (s.imageWidth * k) + 'px ' + (s.imageHeight * k) + 'px;background-position:-'
    + (at.x * k) + 'px -' + (at.y * k) + 'px"></i>';
}

/** Where a graphic sits in its family's sheet, fetching the sheet when it is not here yet. */
function animSheetAt(graphic, family) {
  var s = typeof _famSheets !== 'undefined' ? _famSheets[family] : null;
  if (!s || s === 'pending' || !s.slots) {
    if (typeof ensureFamilySheet === 'function' && family != null) ensureFamilySheet(family);
    return null;
  }
  for (var i = 0; i < s.slots.length; i++) {
    if (s.slots[i][2] === graphic) return { s: s, x: (i % s.columns) * s.cell, y: Math.floor(i / s.columns) * s.cell };
  }
  return null;
}

/**
 * How it looks now: the first cell showing it, drawn as the map draws it
 * (both layers, its flip, the same frames and ticks, off or paused as the map
 * is). Without that stamp's art yet: its frames played from the family sheet.
 */
function animPreviewHtml(e, family, size, cells) {
  if (!editAnimComplete(e)) return animSwatchHtml(e.frames[0], family, size);
  var c = cells && cells[0] ? cells[0].split(',').map(Number) : null;
  var idx = c ? editCellAt(_mtPalette, c[0], c[1]) : -1;
  var cell = idx >= 0 ? editStampSvg(_mtPalette, _editComposed, idx, 0, 0, 'rg-anim-prev-cell') : '';
  if (cell) return '<svg class="rg-anim-sw" width="' + size + '" height="' + size + '" viewBox="0 0 ' + EDIT_UNITS + ' ' + EDIT_UNITS + '">' + cell + '</svg>';
  if (_animOff) return animSwatchHtml(e.frames[0], family, size);
  var at = e.frames.map(function (g) { return animSheetAt(g, family); });
  if (at.some(function (a) { return !a; })) return animSwatchHtml(e.frames[0], family, size);
  var s = at[0].s, k = size / s.cell, total = 0, name = 'rg-ap-' + e.uid + '-' + e.delays.join('-');
  e.delays.forEach(function (t) { total += Math.max(1, t); });
  var css = '@keyframes ' + name + '{', acc = 0;
  at.forEach(function (a, i) {
    css += (acc / total * 100).toFixed(2) + '%{background-position:-' + (a.x * k) + 'px -' + (a.y * k) + 'px}';
    acc += Math.max(1, e.delays[i]);
  });
  css += '}';
  return '<style>' + css + '</style><i class="rg-anim-sw" title="playing at ' + escH(e.delays.join(' ')) + ' ticks" style="width:' + size + 'px;height:'
    + size + 'px;background-image:url(' + s.imageUri + ');background-size:' + (s.imageWidth * k) + 'px ' + (s.imageHeight * k)
    + 'px;animation:' + name + ' ' + (total / 60).toFixed(3) + 's steps(1,end) infinite"></i>';
}

/**
 * Where its cells are, on a thumbnail of the room (the Object rows' look).
 * A long list (`plain`) draws the room's outline only: a copy of the whole
 * map per row made a room with many animated tiles crawl.
 */
function animWhereSvg(cells, plain) {
  var W = _mtPalette && _mtPalette.widthTiles, H = _mtPalette && _mtPalette.heightTiles;
  if (!W || !H) return '';
  var org = _editOrigin;
  return '<svg class="rg-trigger-where" viewBox="' + org.x + ' ' + org.y + ' ' + (W * EDIT_UNITS) + ' ' + (H * EDIT_UNITS)
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + (plain
      ? '<rect class="rg-anim-where-room" x="' + org.x + '" y="' + org.y + '" width="' + (W * EDIT_UNITS) + '" height="' + (H * EDIT_UNITS) + '"/>'
      : '<g class="rg-trigger-where-map"><use href="#rg-img"/><use href="#rg-edit-tiles"/></g>')
    + cells.slice(0, 400).map(function (k) {
      var c = k.split(',').map(Number), b = editCellPos(org, c[0], c[1]);
      return '<rect class="rg-anim-where" x="' + b.x + '" y="' + b.y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS + '"/>';
    }).join('') + '</svg>';
}

/** The family an animated tile is drawn in: off the first cell showing it, else its own word bits. */
function animFamilyOf(e, cells) {
  var p = _mtPalette, pal = 0;
  (cells || []).some(function (k) {
    var c = k.split(',').map(Number), w = editStampWords(p, editCellAt(p, c[0], c[1]));
    if (!w || e.slot == null) return false;
    var word = animWordSlot(w.layer1) === e.slot && w.layer1 !== editBlankCanopy(p) ? w.layer1 : animWordSlot(w.layer2) === e.slot ? w.layer2 : null;
    if (word != null) pal = (word >> 10) & 7;
    return !!pal;
  });
  if (!pal) pal = ((e.pal || 0) >> 10) & 7;
  return pal >= 1 ? editFamilies()[pal - 1] : undefined;
}
