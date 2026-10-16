// Ownership: what a gesture *would* do, shown before it does it — the hover
// ghost of every tool that changes the map (pencil, stamp, eraser, on every
// tab), and the outline of the size a resize drag would make.
//
// Nothing here writes. A preview must never call editAddStamp or adopt a
// family or graphic: looking would grow the dictionary, spend a family slot
// and leave stamps nothing uses. So a ghost draws only from pictures that
// already exist — the brush's own stamp, the Special tab's glyphs — and a
// widget, whose cells would need new stamps and families to picture, is
// rendered by the host at 1:1 from its portable cells (deco-preview.js
// buildConstructGhost), cached per construct.
//
// Drawn in its own group, `#rg-edit-preview`, last in the SVG, so a hover
// redraws one small group and never the whole edit layer.
//
// Owns: _previewCell, _ghostArt, _ghostAsked.

var _previewCell = null;
var _ghostArt = {};
var _ghostAsked = {};

/** The pointer is over `cell` (or off the map, null), with no button down. */
function editPreviewHover(cell) {
  var a = _previewCell;
  if (a === cell || (a && cell && a.x === cell.x && a.y === cell.y && a.qx === cell.qx && a.qy === cell.qy)) return;
  _previewCell = cell;
  renderEditPreview();
}

/** Redraw the ghost (renderEditLayer calls this after every redraw too). */
function renderEditPreview() {
  var svg = document.getElementById('rg-svg');
  if (!svg) return;
  var g = document.getElementById('rg-edit-preview');
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'rg-edit-preview');
    g.setAttribute('pointer-events', 'none');
  }
  // Last, over the overlay group renderEditLayer may have added since.
  if (svg.lastChild !== g) svg.appendChild(g);
  g.innerHTML = editPreviewSvg();
}

/** The ghost for the tool and tab in use, at the hovered cell, or ''. */
function editPreviewSvg() {
  var d = editDraft();
  var c = _previewCell;
  if (!d || !d.on || !c || !_mtPalette || editLocked()) return '';
  if (typeof _resizing !== 'undefined' && _resizing) return '';
  // A copy on the pointer draws its own ghost (map-editor-clipboard.js).
  if (typeof _pasteFloat !== 'undefined' && _pasteFloat) return '';
  if (!editInBounds(_mtPalette, c.x, c.y)) return '';
  var kind = drawKind();
  // Drawing collision on the 8px grid: what the cell becomes, pencil or eraser (map-editor-collision-tab.js).
  if (kind === 'collision' && _collPick < 0 && c.qx != null && d.tool === 'paint') return previewCollDrawSvg(d, c);
  if (d.tool === 'erase') return previewEraseSvg(d, c, kind);
  if (d.tool === 'stamp' || (d.tool === 'paint' && kind === 'widgets')) {
    return _editConstruct >= 0 ? previewConstructSvg(d.constructs[_editConstruct], c) : '';
  }
  if (d.tool !== 'paint') return '';
  var pos = editCellPos(_editOrigin, c.x, c.y);
  if (kind === 'trigger') {
    return previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box rg-preview-trigger-' + (typeof _editTriggerKind !== 'undefined' ? _editTriggerKind : 'b'));
  }
  if (kind === 'object') return previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box');
  if (kind === 'anim') return previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box rg-preview-anim');
  if (kind === 'collision') {
    if (_collPick < 0) return '';
    return '<path class="rg-preview-ghost" d="' + collMaskPath(_collPick, pos.x, pos.y, EDIT_UNITS / 16) + '" fill="'
      + collLevelColor(collCellLevel(c.x, c.y)) + '"/>' + previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box');
  }
  if (kind === 'special') {
    if (!d.currentSpecialId || typeof editSpecialGlyphSvg !== 'function') return '';
    return '<g class="rg-preview-ghost">' + editSpecialGlyphSvg(d.currentSpecialId, pos.x, pos.y) + '</g>'
      + previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box');
  }
  if (d.brush < 0) return '';
  return editStampSvg(_mtPalette, _editComposed, d.brush, pos.x, pos.y, 'rg-edit-cell rg-preview-ghost')
    + previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box');
}

/** The cell as this pen (or eraser) stroke would leave it — the tile it would match, or a "?". */
function previewCollDrawSvg(d, c) {
  var pos = editCellPos(_editOrigin, c.x, c.y), h = EDIT_UNITS / 2;
  // The pen's stroke; a right-button carve shows itself as it happens.
  var next = collDrawNext(c, false);
  var code = collCodeOfQuarters(next & 15, next & COLL_STOP);
  return '<g class="rg-preview-ghost">' + collDrawnCellSvg(pos, next, code, collLevelColor(collCellLevel(c.x, c.y))) + '</g>'
    + '<rect class="rg-preview-box" x="' + (pos.x + c.qx * h)
    + '" y="' + (pos.y + c.qy * h) + '" width="' + h + '" height="' + h + '"/>';
}

/** A cell-aligned outline, `w`×`h` cells from (x, y). */
function previewBoxSvg(x, y, w, h, cls) {
  var a = editCellPos(_editOrigin, x, y);
  return '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + (w * EDIT_UNITS)
    + '" height="' + (h * EDIT_UNITS) + '"/>';
}

/**
 * What the eraser would take at `c`: the cell struck through in the error
 * colour, or a plain outline when there is nothing there for it to take —
 * the same reading editEraseCells makes, without making the stamp.
 */
function previewEraseSvg(d, c, kind) {
  var hit = false;
  var box = { x: c.x, y: c.y, w: 1, h: 1 };
  if (kind === 'trigger') {
    var ref = editTriggerAt(c.x, c.y);
    var t = ref && editTriggerFind(ref);
    if (t) { hit = true; box = { x: t.x1, y: t.y1, w: t.x2 - t.x1 + 1, h: t.y2 - t.y1 + 1 }; }
  } else if (kind === 'special') {
    hit = !!editSpecialAt(c.x, c.y);
  } else if (kind === 'collision') {
    hit = editCollisionAt(c.x, c.y) >= 0 || collDrawAt(c.x, c.y) >= 0;
  } else if (cutLayerActive()) {
    hit = !!(d.cut && d.cut[editKey(c.x, c.y)] != null);
  } else {
    hit = previewEraseHits(c);
  }
  if (!hit) return previewBoxSvg(c.x, c.y, 1, 1, 'rg-preview-box');
  var a = editCellPos(_editOrigin, box.x, box.y);
  var x2 = a.x + box.w * EDIT_UNITS;
  var y2 = a.y + box.h * EDIT_UNITS;
  return previewBoxSvg(box.x, box.y, box.w, box.h, 'rg-preview-erase')
    + '<path class="rg-preview-erase-x" d="M' + a.x + ' ' + a.y + 'L' + x2 + ' ' + y2
    + 'M' + x2 + ' ' + a.y + 'L' + a.x + ' ' + y2 + '"/>';
}

/** Whether the Tile eraser has anything to take at `c` (editResolve's erase branch, read-only). */
function previewEraseHits(c) {
  // A placed widget's tiles are locked to it (map-editor-gestures.js).
  if (typeof editGroupAt === 'function' && editGroupAt(c.x, c.y)) return false;
  if (editSpecialAt(c.x, c.y)) return true;
  var here = editCellAt(_mtPalette, c.x, c.y);
  var under = here >= 0 ? editStampWords(_mtPalette, here) : null;
  if (!under) return false;
  var layers = editEraseLayers();
  var hasCanopy = under.layer1 !== editBlankCanopy(_mtPalette);
  if (layers.fg && hasCanopy) return true;
  if (!layers.bg) return false;
  // The ground: under front art it goes on its own; otherwise only a cell the draft wrote comes off.
  return hasCanopy || Object.prototype.hasOwnProperty.call(editDraft().cells, editKey(c.x, c.y));
}

/** A construct about to be stamped with its corner at `c`: its own picture, and its box. */
function previewConstructSvg(construct, c) {
  if (!construct) return '';
  var box = previewBoxSvg(c.x, c.y, construct.w, construct.h, 'rg-preview-box');
  var key = previewConstructKey(construct);
  var art = _ghostArt[key];
  if (!art) { requestConstructGhost(construct, key); return box; }
  var a = editCellPos(_editOrigin, c.x, c.y);
  return '<image class="rg-preview-ghost" href="' + art.imageUri + '" x="' + a.x + '" y="' + a.y
    + '" width="' + (construct.w * EDIT_UNITS) + '" height="' + (construct.h * EDIT_UNITS)
    + '" preserveAspectRatio="none" style="image-rendering:pixelated"/>' + box;
}

/** A construct's identity for the cache: its size and its cells, nothing room-relative. */
function previewConstructKey(construct) {
  return JSON.stringify([construct.w, construct.h, construct.cells]);
}

function requestConstructGhost(construct, key) {
  if (_ghostAsked[key] || typeof vs === 'undefined' || !vs) return;
  _ghostAsked[key] = true;
  vs.postMessage({ command: 'requestDeco', ghost: { key: key, w: construct.w, h: construct.h, cells: construct.cells } });
}

/** The host rendered a construct's ghost (bootstrap.js `decoGhost`). */
function applyDecoGhost(msg) {
  if (!msg || !msg.key || !msg.ghost) return;
  _ghostArt[msg.key] = msg.ghost;
  renderEditPreview();
}

// ---------------------------------------------------------------------------
// Resizing: the size the drag would make, over the map
// ---------------------------------------------------------------------------

/**
 * The outline of the map a resize drag would make, with everything outside
 * it dimmed — so a shrink shows what it hides and a grow what it adds,
 * before the button comes up. Placed like the grip, in percent of the canvas.
 */
function resizePreviewSync() {
  var canvas = document.getElementById('rg-canvas') || document.getElementById('rg-wrap');
  var el = document.getElementById('rg-resize-ghost');
  var r = typeof _resizing !== 'undefined' ? _resizing : null;
  if (!r) {
    if (el) el.parentNode.removeChild(el);
    if (typeof editPlaceResizeGrip === 'function') editPlaceResizeGrip();
    return;
  }
  var svg = document.getElementById('rg-svg');
  var img = document.getElementById('rg-img');
  var vb = svg && svg.viewBox && svg.viewBox.baseVal;
  if (!canvas || !vb || !vb.width || !img) return;
  if (!el) {
    el = document.createElement('div');
    el.id = 'rg-resize-ghost';
    el.className = 'rg-resize-ghost';
    canvas.appendChild(el);
  }
  var x0 = Number(img.getAttribute('x')) || 0;
  var y0 = Number(img.getAttribute('y')) || 0;
  el.style.left = ((x0 - vb.x) / vb.width * 100) + '%';
  el.style.top = ((y0 - vb.y) / vb.height * 100) + '%';
  el.style.width = (r.w * EDIT_UNITS / vb.width * 100) + '%';
  el.style.height = (r.h * EDIT_UNITS / vb.height * 100) + '%';
  // The grip and its label ride the new corner, under the pointer.
  var right = ((x0 + r.w * EDIT_UNITS - vb.x) / vb.width * 100) + '%';
  var bottom = ((y0 + r.h * EDIT_UNITS - vb.y) / vb.height * 100) + '%';
  ['rg-resize', 'rg-resize-label'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) { e.style.left = right; e.style.top = bottom; }
  });
}
