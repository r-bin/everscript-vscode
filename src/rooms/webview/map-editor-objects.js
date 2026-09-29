// Ownership: the Object tab — objects on a map, their frames (states), and the tiles drawn over them.
// An object cluster (dotted blue line) marks the rectangle we work in.
// Inside the cluster, an object has frames (states 0..N):
//   - State 0: base room appearance (what the map loads with)
//   - Frame 1..N: changed states with delta tiles; size and delta bounds calculated automatically (solid blue frame).
// Objects and frames are order sensitive (0..x). Frames can be added, removed (with confirmation), and reordered.

var _objectSel = null, _objectExpanded = null, _objectActiveFrame = 1;
var _confirmRemoveFrame = null, _objectDraw = null, _objectPainting = false;

function editObjects() {
  var d = editDraft();
  return ((d && d.placed) || []).filter(function (p) { return p.kind === 'object' && !p.removed; });
}

function editObjectFind(uid) {
  var list = editObjects();
  for (var i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

function editObjectFrames(o) {
  if (!o.frames || !Array.isArray(o.frames)) {
    o.frames = (o.layer && Object.keys(o.layer).length) ? [Object.assign({}, o.layer)] : [];
  }
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
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
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
  _objectSel = uid; _objectExpanded = uid; _confirmRemoveFrame = null;
  if (uid != null && typeof _editActiveTab !== 'undefined') _editActiveTab = 'object';
  var o = editObjectFind(uid);
  if (o) {
    var frames = editObjectFrames(o);
    if (_objectActiveFrame < 0 || _objectActiveFrame > frames.length) _objectActiveFrame = frames.length > 0 ? 1 : 0;
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
  _objectSel = uid; _objectExpanded = uid; _objectActiveFrame = frames.length;
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
  _objectActiveFrame = to + 1; o.layer = frames[_objectActiveFrame - 1]; _confirmRemoveFrame = null;
  editEnd();
  editNote('Moved frame to #' + _objectActiveFrame);
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function objectMove(uid, dir) {
  var d = editDraft();
  if (!d || !d.placed) return;
  var objs = editObjects(), idx = -1;
  for (var i = 0; i < objs.length; i++) if (objs[i].uid === uid) { idx = i; break; }
  var to = idx + dir;
  if (idx < 0 || to < 0 || to >= objs.length) return;
  editBegin();
  var p1 = objs[idx], p2 = objs[to];
  d.placed[d.placed.indexOf(p1)] = p2; d.placed[d.placed.indexOf(p2)] = p1;
  editEnd();
  editNote('Moved object to index #' + to);
  renderEditChrome();
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
  _objectSel = uid; _objectExpanded = uid; _objectActiveFrame = 0; _confirmRemoveFrame = null;
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
  if (_objectExpanded === uid) _objectExpanded = null;
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
    var activeIdx = isSel ? _objectActiveFrame : 0;
    var curLayer = activeIdx >= 1 ? (frames[activeIdx - 1] || o.layer || {}) : {};
    Object.keys(curLayer).forEach(function (k) {
      var p = k.split(','), pos = editCellPos(origin, o.x + Number(p[0]), o.y + Number(p[1]));
      html += editStampSvg(palette, composed, curLayer[k], pos.x, pos.y, 'rg-edit-cell rg-obj-cell');
    });
    var a = editCellPos(origin, o.x, o.y);
    html += '<rect class="rg-obj-area rg-obj-cluster' + (isSel ? ' sel' : '') + '" x="' + a.x + '" y="' + a.y
      + '" width="' + (o.w * EDIT_UNITS) + '" height="' + (o.h * EDIT_UNITS) + '" pointer-events="none">'
      + '<title>' + escH('obj #' + idx + ' cluster: ' + o.w + '×' + o.h + ' at ' + o.x + ',' + o.y) + '</title></rect>';
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

// ── the tab ────────────────────────────────────────────────────────────────

function objectFrameThumb(o, frameIdx, org) {
  var a = editCellPos(org, o.x, o.y), bw = o.w * EDIT_UNITS, bh = o.h * EDIT_UNITS;
  var maxDim = Math.max(o.w, o.h, 1), tw = Math.round(30 * o.w / maxDim), th = Math.round(30 * o.h / maxDim), tiles = '';
  if (frameIdx >= 1) {
    var frames = editObjectFrames(o), layer = frames[frameIdx - 1] || {};
    Object.keys(layer).forEach(function (k) {
      var p = k.split(','), pos = editCellPos(org, o.x + Number(p[0]), o.y + Number(p[1]));
      tiles += editStampSvg(_mtPalette, _editComposed, layer[k], pos.x, pos.y, 'rg-edit-cell');
    });
  }
  return '<svg class="ro-img" width="' + tw + '" height="' + th + '" viewBox="' + a.x + ' ' + a.y + ' ' + bw + ' ' + bh
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#rg-img"/><use href="#rg-edit-tiles"/>' + tiles + '</svg>';
}

/** One object row with expanded state chips. */
function objectRowHtml(o, n, listLen) {
  var org = _editOrigin, frames = editObjectFrames(o);
  var isSel = (o.uid === _objectSel), isExpanded = (o.uid === _objectExpanded);
  var h = '<div class="rg-object-card' + (isSel ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-object-row' + (isSel ? ' on' : '') + '" data-object-sel="' + o.uid
    + '" title="' + escH('obj #' + n + ' at ' + o.x + ',' + o.y + ' (' + o.w + '×' + o.h + ') — ' + (frames.length + 1) + ' states') + '">'
    + '<span class="rg-object-caret" data-object-toggle="' + o.uid + '">' + (isExpanded ? '▾' : '▸') + '</span>'
    + '<span class="rg-trigger-label"><b>obj ' + n + '</b> · ' + o.w + '×' + o.h + ' at ' + o.x + ',' + o.y + '</span>'
    + '<button class="rdf rdf-xs rg-obj-move" data-object-move-obj="-1" data-object-uid="' + o.uid + '" title="Move object up in order"' + (n === 0 ? ' disabled' : '') + '>▲</button>'
    + '<button class="rdf rdf-xs rg-obj-move" data-object-move-obj="1" data-object-uid="' + o.uid + '" title="Move object down in order"' + (n >= listLen - 1 ? ' disabled' : '') + '>▼</button>'
    + '<button class="rdf rg-trigger-remove" data-object-remove="' + o.uid + '" title="Remove this object">×</button></div>';
  if (isExpanded) {
    h += '<div class="rg-object-expanded"><div class="ro-chips">'
      + '<button class="ro-chip' + (_objectActiveFrame === 0 ? ' sel' : '') + '" data-object-uid="' + o.uid + '" data-object-frame="0" title="State 0 — base look (as the room loads)">'
      + objectFrameThumb(o, 0, org) + '<span class="ro-lbl">0</span></button>';
    for (var f = 1; f <= frames.length; f++) {
      var b = objectFrameBounds(frames[f - 1]);
      var tip = 'Frame ' + f + (b ? ' — ' + b.w + '×' + b.h + ' (' + b.count + ' delta tiles)' : ' — same as base');
      h += '<button class="ro-chip' + (_objectActiveFrame === f ? ' sel' : '') + '" data-object-uid="' + o.uid + '" data-object-frame="' + f + '" title="' + escH(tip) + '">'
        + objectFrameThumb(o, f, org) + '<span class="ro-lbl">' + f + '</span></button>';
    }
    h += '<button class="ro-chip ro-chip-add" data-object-add-frame="' + o.uid + '" title="Add new frame to obj #' + n + '">+</button></div>'
      + '<div class="rg-object-frame-bar">';
    if (_objectActiveFrame === 0) {
      h += '<span class="rg-obj-frame-info">State 0: Base look (loads with room)</span>'
        + (frames.length ? '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-frame="1" title="Frame 1">▶</button>' : '');
    } else {
      var curB = objectFrameBounds(frames[_objectActiveFrame - 1]);
      var deltaInfo = curB ? (curB.w + '×' + curB.h + ' (' + curB.count + ' delta tiles)') : 'same as base';
      var prevF = _objectActiveFrame - 1, nextF = _objectActiveFrame + 1;
      h += '<span class="rg-obj-frame-info">Frame ' + _objectActiveFrame + ': ' + deltaInfo + '</span>'
        + '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-frame="' + prevF + '" title="' + (prevF === 0 ? 'State 0 (base)' : 'Frame ' + prevF) + '">◀</button>'
        + '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-frame="' + nextF + '" title="Frame ' + nextF + '"' + (_objectActiveFrame >= frames.length ? ' disabled' : '') + '>▶</button>';
      h += (_confirmRemoveFrame === _objectActiveFrame)
        ? '<button class="rdf rdf-xs rdf-warn" data-object-uid="' + o.uid + '" data-object-confirm-remove-frame="' + _objectActiveFrame + '" title="Confirm delete">Delete?</button><button class="rdf rdf-xs" data-object-cancel-remove-frame="1" title="Cancel">Cancel</button>'
        : '<button class="rdf rdf-xs" data-object-uid="' + o.uid + '" data-object-remove-frame="' + _objectActiveFrame + '" title="Remove frame ' + _objectActiveFrame + '">Delete frame</button>';
    }
    h += '</div></div>';
  }
  return h + '</div>';
}

function objectTabHtml() {
  var list = editObjects();
  var html = '<div class="rs-note">Objects are areas that change appearance when a script triggers them. '
    + 'The dotted blue line marks the cluster rectangle. Inside it, draw delta tiles for each frame (solid blue frame).'
    + '</div><div class="rg-trigger-list">';
  if (!list.length) html += '<div class="rs-note">none yet — drag an area on the map with the pencil</div>';
  list.forEach(function (o, i) { html += objectRowHtml(o, i, list.length); });
  html += '</div>';
  var own = (_mtPalette && _mtPalette.attachments && _mtPalette.attachments.objects) || [];
  if (own.length) html += '<div class="rs-note">This room also has ' + own.length + ' object' + (own.length === 1 ? '' : 's') + ' of its own.</div>';
  return html;
}

/** A click the Object tab owns (map-editor-input.js). */
function objectClick(t) {
  if (t.dataset.objectRemove) { editRemoveObject(Number(t.dataset.objectRemove)); return true; }
  if (t.dataset.objectToggle) {
    var tuid = Number(t.dataset.objectToggle);
    _objectExpanded = (_objectExpanded === tuid) ? null : tuid;
    if (_objectExpanded) objectSelect(tuid); else renderEditChrome();
    return true;
  }
  if (t.dataset.objectSel) { objectSelect(Number(t.dataset.objectSel)); return true; }
  if (t.dataset.objectFrame) { objectSelectFrame(Number(t.dataset.objectFrame), t.dataset.objectUid ? Number(t.dataset.objectUid) : undefined); return true; }
  if (t.dataset.objectAddFrame) { objectAddFrame(Number(t.dataset.objectAddFrame)); return true; }
  if (t.dataset.objectRemoveFrame) {
    _confirmRemoveFrame = Number(t.dataset.objectRemoveFrame);
    renderEditChrome();
    return true;
  }
  if (t.dataset.objectConfirmRemoveFrame) { objectRemoveFrame(Number(t.dataset.objectUid), Number(t.dataset.objectConfirmRemoveFrame)); return true; }
  if (t.dataset.objectCancelRemoveFrame) { _confirmRemoveFrame = null; renderEditChrome(); return true; }
  if (t.dataset.objectMoveFrame) { objectMoveFrame(Number(t.dataset.objectUid), Number(t.dataset.objectMoveFrame)); return true; }
  if (t.dataset.objectMoveObj) { objectMove(Number(t.dataset.objectUid), Number(t.dataset.objectMoveObj)); return true; }
  return false;
}
