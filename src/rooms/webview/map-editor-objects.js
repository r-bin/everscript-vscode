// Ownership: the Object tab — objects on a map, their frames (states), and the tiles drawn over them.
// An object cluster (dotted blue line) marks the rectangle we work in.
// Inside the cluster, an object has frames (states 0..N):
//   - State 0: base room appearance (what the map loads with)
//   - Frame 1..N: changed states with delta tiles; size and delta bounds calculated automatically (solid blue frame).
// Objects and frames are order sensitive (0..x). Frames can be added, removed (with confirmation), and reordered.
// The tab's list (rows, state chips, drag to reorder) is map-editor-object-list.js.

var _objectSel = null, _objectActiveFrame = 1;
var _confirmRemoveFrame = null, _objectDraw = null, _objectPainting = false;

function editObjects() {
  var d = editDraft();
  return ((d && d.placed) || []).filter(function (p) { return p.kind === 'object' && !p.removed; });
}

function editObjectFind(uid) {
  return editObjects().find(function (p) { return p.uid === uid; }) || null;
}

function editObjectFrames(o) {
  if (!o.frames || !Array.isArray(o.frames)) o.frames = (o.layer && Object.keys(o.layer).length) ? [Object.assign({}, o.layer)] : [];
  return o.frames;
}

function objectNormalizeFrames(frames) {
  if (!Array.isArray(frames)) return [];
  return frames.some(function (f) { return f && Object.keys(f).length > 0; }) ? frames : [];
}

/** Tightly bounded delta tiles box for an object frame. */
function objectFrameBounds(layer) {
  var keys = Object.keys(layer || {});
  if (!keys.length) return null;
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < keys.length; i++) {
    var p = keys[i].split(','), x = Number(p[0]), y = Number(p[1]);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { dx: minX, dy: minY, w: maxX - minX + 1, h: maxY - minY + 1, count: keys.length };
}

/** The object whose area holds this cell — the smallest, as nested ones are more specific. */
function editObjectAt(x, y) {
  var best = null;
  editObjects().forEach(function (o) {
    if (x < o.x || y < o.y || x >= o.x + o.w || y >= o.y + o.h) return;
    if (!best || o.w * o.h < best.w * best.h) best = o;
  });
  return best;
}

function objectSelect(uid) {
  if (typeof editDeselectAll === 'function') editDeselectAll();
  _objectSel = uid; _confirmRemoveFrame = null;
  if (uid != null && typeof _editActiveTab !== 'undefined') _editActiveTab = 'object';
  var o = editObjectFind(uid);
  if (o) {
    var frames = editObjectFrames(o);
    if (o.activeFrame != null && o.activeFrame >= 0 && o.activeFrame <= frames.length) {
      _objectActiveFrame = o.activeFrame;
    } else if (_objectActiveFrame < 0 || _objectActiveFrame > frames.length) {
      _objectActiveFrame = frames.length > 0 ? 1 : 0;
    }
    o.activeFrame = _objectActiveFrame;
    o.layer = _objectActiveFrame >= 1 ? (frames[_objectActiveFrame - 1] || {}) : {};
    o.states = frames.length + 1;
    editNote('obj #' + editObjects().indexOf(o) + ' selected — frame #' + _objectActiveFrame + ' active');
  }
  renderEditChrome();
}

function objectSelectFrame(f, uid) {
  if (uid != null) _objectSel = uid;
  _objectActiveFrame = f; _confirmRemoveFrame = null;
  var o = editObjectFind(_objectSel);
  if (o) {
    var frames = editObjectFrames(o);
    if (_objectActiveFrame < 0) _objectActiveFrame = 0;
    if (_objectActiveFrame > frames.length) _objectActiveFrame = frames.length > 0 ? frames.length : 0;
    o.activeFrame = _objectActiveFrame;
    o.layer = _objectActiveFrame >= 1 ? (frames[_objectActiveFrame - 1] || {}) : {};
    editNote('obj #' + editObjects().indexOf(o) + ' — ' + (f === 0 ? 'State 0 (base)' : 'Frame #' + f));
  }
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function objectAddFrame(uid) {
  var o = editObjectFind(uid);
  if (!o) return;
  editBegin();
  var frames = editObjectFrames(o);
  var curFrame = _objectActiveFrame >= 1 ? (frames[_objectActiveFrame - 1] || {}) : {};
  var newFrame = Object.assign({}, curFrame);
  frames.push(newFrame);
  o.frameSpecials = o.frameSpecials || [];
  var curSpecials = _objectActiveFrame >= 1 ? (o.frameSpecials[_objectActiveFrame - 1] || {}) : {};
  o.frameSpecials.push(Object.assign({}, curSpecials));
  o.states = frames.length + 1;
  _objectSel = uid; _objectActiveFrame = frames.length;
  o.activeFrame = _objectActiveFrame;
  o.layer = newFrame; _confirmRemoveFrame = null;
  editEnd();
  editNote('Added frame #' + _objectActiveFrame + ' to obj #' + editObjects().indexOf(o));
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function objectRemoveFrame(uid, f) {
  var o = editObjectFind(uid);
  if (!o || f < 1) return;
  editBegin();
  var frames = editObjectFrames(o);
  frames.splice(f - 1, 1);
  if (o.frameSpecials) o.frameSpecials.splice(f - 1, 1);
  o.states = frames.length + 1;
  _objectActiveFrame = Math.max(0, Math.min(_objectActiveFrame, frames.length));
  o.activeFrame = _objectActiveFrame;
  o.layer = _objectActiveFrame >= 1 ? frames[_objectActiveFrame - 1] : {};
  _confirmRemoveFrame = null;
  editEnd();
  editNote('Removed frame #' + f + ' from obj #' + editObjects().indexOf(o));
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function objectMoveFrame(uid, dir) {
  var o = editObjectFind(uid);
  if (!o || _objectActiveFrame < 1) return;
  var frames = editObjectFrames(o), from = _objectActiveFrame - 1, to = from + dir;
  if (from < 0 || to < 0 || to >= frames.length) return;
  editBegin();
  var tmp = frames[from]; frames[from] = frames[to]; frames[to] = tmp;
  if (o.frameSpecials) {
    var tmps = o.frameSpecials[from]; o.frameSpecials[from] = o.frameSpecials[to]; o.frameSpecials[to] = tmps;
  }
  _objectActiveFrame = to + 1; o.activeFrame = _objectActiveFrame; o.layer = frames[_objectActiveFrame - 1]; _confirmRemoveFrame = null;
  editEnd();
  editNote('Moved frame to #' + _objectActiveFrame);
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** A gesture on the Object tab. Returns true when it was the object's. */
function editObjectGesture(d, cell, phase) {
  var sel = editObjectFind(_objectSel), hit = editObjectAt(cell.x, cell.y);
  if (d.tool === 'select') {
    if (phase !== 'down' || !hit) return false;
    objectSelect(hit.uid); return true;
  }
  if (d.tool === 'erase') {
    if (phase === 'down') editBegin();
    if (sel && editObjectContains(sel, cell)) objectLayerWrite(sel, cell, true);
    if (phase === 'up') editEnd();
    return true;
  }
  if (d.tool !== 'paint') return false;
  if (phase === 'down') {
    _objectPainting = false;
    if (sel && hit && hit.uid === sel.uid) { editBegin(); _objectPainting = true; objectLayerWrite(sel, cell, false); return true; }
    if (typeof _editActiveTab !== 'undefined' && _editActiveTab !== 'object') return false;
    if (hit) { objectSelect(hit.uid); return true; }
    _objectDraw = { ax: cell.x, ay: cell.y };
    return true;
  }
  if (_objectDraw) {
    _objectDraw.x1 = Math.min(_objectDraw.ax, cell.x); _objectDraw.x2 = Math.max(_objectDraw.ax, cell.x);
    _objectDraw.y1 = Math.min(_objectDraw.ay, cell.y); _objectDraw.y2 = Math.max(_objectDraw.ay, cell.y);
    if (phase !== 'up') { renderEditLayer(_mtPalette, _editComposed, _editOrigin); return true; }
    var box = _objectDraw; _objectDraw = null;
    editAddObject(box); return true;
  }
  if (_objectPainting) {
    if (sel && phase !== 'up' && editObjectContains(sel, cell)) objectLayerWrite(sel, cell, false);
    if (phase === 'up') { editEnd(); _objectPainting = false; }
    return true;
  }
  return false;
}

function editObjectContains(o, cell) {
  return cell.x >= o.x && cell.y >= o.y && cell.x < o.x + o.w && cell.y < o.y + o.h;
}

/** A new object over `box` (inclusive cells), selected. Part of the gesture's undo step. */
function editAddObject(box) {
  var d = editDraft(), uid = editNextPlacedUid();
  var o = { kind: 'object', uid: uid, x: box.x1, y: box.y1, w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1, states: 1, frames: [], layer: {} };
  d.placed.push(o);
  _objectSel = uid; _objectActiveFrame = 0; _confirmRemoveFrame = null;
  editNote('obj #' + (editObjects().length - 1) + ' added — ' + o.w + '×' + o.h + '. Click + Frame to add a changed state.');
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function objectCellLevel(cell) {
  var i = editCellAt(_mtPalette, cell.x, cell.y);
  var w = i >= 0 ? editStampWords(_mtPalette, i) : null;
  return w ? (w.collision >> 4) & 3 : editLevel();
}

/** Draw (or erase) one tile of an object's layer with the brush. */
function objectLayerWrite(o, cell, erase) {
  var d = editDraft();
  if (_objectActiveFrame === 0) {
    editNote('Frame 0 is base map — select Frame 1 or click + Frame to draw changed tiles');
    renderEditChrome(); return;
  }
  var frames = editObjectFrames(o), frameLayer = frames[_objectActiveFrame - 1] || {};
  var key = (cell.x - o.x) + ',' + (cell.y - o.y), layer = Object.assign({}, frameLayer);
  if (erase) {
    if (!(key in layer)) return;
    delete layer[key];
  } else {
    if (d.brush < 0) { editNote('pick a tile in the Tile tab first — the pencil draws it onto the object'); renderEditChrome(); return; }
    var idx = typeof editOnLevel === 'function' ? editOnLevel(_mtPalette, d.brush, objectCellLevel(cell)) : d.brush;
    if (layer[key] === idx) return;
    layer[key] = idx;
  }
  frames[_objectActiveFrame - 1] = layer;
  o.layer = layer;
  if (typeof editCellsChanged === 'function') editCellsChanged();
  requestComposedPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** Remove an object (the list's ×). One undo step. */
function editRemoveObject(uid) {
  var d = editDraft();
  if (!d) return;
  editBegin();
  d.placed = d.placed.filter(function (p) { return !(p.kind === 'object' && p.uid === uid); });
  editEnd();
  if (_objectSel === uid) _objectSel = null;
  editNote('object removed');
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  requestComposedPreview();
}

/** Stamps an object's layer uses, for pruning and the family sync. */
function editObjectStamps() {
  var out = [];
  editObjects().forEach(function (o) {
    editObjectFrames(o).forEach(function (f) {
      Object.keys(f || {}).forEach(function (k) { out.push(f[k]); });
    });
  });
  return out;
}

function editObjectsVisible() {
  var p = document.getElementById('room-detail') || document.getElementById('rg-outer');
  if (p && p.classList.contains('hide-obj')) return false;
  return typeof _currentOverlay !== 'string' || _currentOverlay.indexOf('o') >= 0;
}

/** Areas as dotted blue clusters; active frame delta as solid blue frame. */
function editObjectSvg(palette, composed, origin) {
  if (!editObjectsVisible()) return '';
  var html = '';
  editObjects().forEach(function (o, idx) {
    var isSel = (o.uid === _objectSel), frames = editObjectFrames(o);
    var activeIdx = isSel ? _objectActiveFrame : (o.activeFrame != null ? o.activeFrame : (frames.length > 0 ? 1 : 0));
    var curLayer = activeIdx >= 1 ? (frames[activeIdx - 1] || o.layer || {}) : {};
    Object.keys(curLayer).forEach(function (k) {
      var p = k.split(','), pos = editCellPos(origin, o.x + Number(p[0]), o.y + Number(p[1]));
      html += editStampSvg(palette, composed, curLayer[k], pos.x, pos.y, 'rg-edit-cell rg-obj-cell');
    });
    var a = editCellPos(origin, o.x, o.y);
    // The number a script's SET OBJ names: the room's own, else its place in the list.
    var num = objectNumber(o, idx);
    html += '<rect class="rg-obj-area rg-obj-cluster' + (isSel ? ' sel' : '') + '" x="' + a.x + '" y="' + a.y
      + '" width="' + (o.w * EDIT_UNITS) + '" height="' + (o.h * EDIT_UNITS) + '" pointer-events="none">'
      + '<title>' + escH('obj ' + num + ' (0x' + num.toString(16) + ') cluster: ' + o.w + '×' + o.h + ' at ' + o.x + ',' + o.y) + '</title></rect>'
      // Top-right: the top-left belongs to a trigger's label, and a gourd's
      // B-trigger shares its first cell with it.
      + '<text class="rg-corner-lbl rg-obj-id" x="' + (a.x + o.w * EDIT_UNITS - EDIT_UNITS * 0.12) + '" y="' + (a.y + EDIT_UNITS * 0.3)
      + '" font-size="' + (EDIT_UNITS * 0.22) + '" text-anchor="end" pointer-events="none">' + num + '</text>';
    // Where each changed state draws, for every object (the filter bar's Sub-frames).
    frames.forEach(function (f, fi) {
      var sb = objectFrameBounds(f);
      if (!sb) return;
      var sp = editCellPos(origin, o.x + sb.dx, o.y + sb.dy);
      html += '<rect class="rg-obj-subframe" x="' + sp.x + '" y="' + sp.y + '" width="' + (sb.w * EDIT_UNITS)
        + '" height="' + (sb.h * EDIT_UNITS) + '" pointer-events="none"><title>' + escH('obj ' + num + ' frame ' + (fi + 1)
        + ': ' + sb.w + '×' + sb.h + ' (' + sb.count + ' tiles)') + '</title></rect>';
    });
    if (isSel && activeIdx >= 1) {
      var b = objectFrameBounds(curLayer);
      if (b) {
        var fx = editCellPos(origin, o.x + b.dx, o.y + b.dy);
        html += '<rect class="rg-obj-frame" x="' + fx.x + '" y="' + fx.y + '" width="' + (b.w * EDIT_UNITS)
          + '" height="' + (b.h * EDIT_UNITS) + '" pointer-events="none"><title>' + escH('frame #' + activeIdx + ' delta: ' + b.w + '×' + b.h + ' (' + b.count + ' tiles)') + '</title></rect>';
      }
    }
  });
  if (_objectDraw && _objectDraw.x1 != null) {
    var b = editCellPos(origin, _objectDraw.x1, _objectDraw.y1);
    html += '<rect class="rg-obj-area rg-obj-drag" x="' + b.x + '" y="' + b.y + '" width="'
      + ((_objectDraw.x2 - _objectDraw.x1 + 1) * EDIT_UNITS) + '" height="' + ((_objectDraw.y2 - _objectDraw.y1 + 1) * EDIT_UNITS) + '" pointer-events="none"/>';
  }
  return html;
}
