// Ownership: the Widgets tab's Placed list — one row per widget stamped on
// the map (a group, map-editor-groups.js), drawn like the Object tab's rows
// (map-editor-object-list.js): grip, where in the room, how it looks,
// `#n · name`, disband, remove.
//
// The list is the draw order: groups are composed over the map in
// `_edit.groups` order, so a later row is drawn on top of an earlier one
// where they overlap. Drag a row by its grip to change it.
//
// A placed widget is one locked thing: its tiles, triggers and objects
// move and go together. Disband (editGroupDisband) writes it into the map
// and lets its triggers and objects go, to be edited on their own.
//
// Owns: _placedDragRow.

var _placedDragRow = null, _placedOpen = {};

/** Find the widget definition for a placed group. */
function placedFindWidget(g) {
  if (typeof _widgets !== 'undefined' && _widgets) {
    if (g.widget) {
      for (var i = 0; i < _widgets.length; i++) if (_widgets[i].id === g.widget) return _widgets[i];
    }
    for (var j = 0; j < _widgets.length; j++) {
      var w = _widgets[j];
      if (w.name === g.name || (g.name && g.name.indexOf(w.name) === 0)) return w;
    }
  }
  if (g.cells && typeof widgetAttestedFamilies === 'function') {
    var c = typeof editGroupConstruct === 'function' ? editGroupConstruct(_mtPalette, g) : null;
    var fams = c && widgetAttestedFamilies(c.cells);
    if (fams && fams.length > 1) {
      var gw = { id: 'g-' + g.uid, name: g.name, w: g.w, h: g.h, cells: c.cells };
      if (typeof widgetEnsureVariations === 'function') widgetEnsureVariations(gw);
      return gw;
    }
  }
  return null;
}

/** Find the first attached object of a group, if any. */
function placedGroupObject(g) {
  var d = editDraft();
  if (!d || !d.placed || !g.placed) return null;
  for (var i = 0; i < d.placed.length; i++) {
    var p = d.placed[i];
    if (!p.removed && p.kind === 'object' && g.placed.indexOf(p.uid) >= 0) return p;
  }
  return null;
}

function placedOpenKey(g) {
  var d = editDraft();
  return (d ? d.customKey || d.roomId : '') + ':' + g.uid;
}

function placedIsOpen(g, hasChips) {
  var k = placedOpenKey(g);
  if (Object.prototype.hasOwnProperty.call(_placedOpen, k)) return _placedOpen[k];
  return g.uid === _groupSel || !!hasChips;
}

/** Its triggers and objects, as a short phrase ('' when none). */
function placedPartsText(g) {
  var d = editDraft();
  var n = { trig: 0, obj: 0 };
  ((d && d.placed) || []).forEach(function (p) {
    if (p.removed || g.placed.indexOf(p.uid) < 0) return;
    if (p.kind === 'object') n.obj += 1; else n.trig += 1;
  });
  var out = [];
  if (n.trig) out.push(n.trig + ' trigger' + (n.trig === 1 ? '' : 's'));
  if (n.obj) out.push(n.obj + ' object' + (n.obj === 1 ? '' : 's'));
  return out.join(', ');
}

function editSlotUsageCount(palette, slot, excludeUid) {
  var d = editDraft();
  if (!d || !palette) return 0;
  var count = 0;
  var shown = typeof editBakedCells === 'function' ? editBakedCells(palette) : d.cells;
  var keys = Object.keys(shown || {});
  for (var i = 0; i < keys.length; i++) {
    var w = editStampWords(palette, shown[keys[i]]);
    if (w && (editWordFamilySlot(w.layer1) === slot || editWordFamilySlot(w.layer2) === slot)) count++;
  }
  if (d.cut) {
    var cutKeys = Object.keys(d.cut);
    for (var j = 0; j < cutKeys.length; j++) {
      var cw = editStampWords(palette, d.cut[cutKeys[j]]);
      if (cw && (editWordFamilySlot(cw.layer1) === slot || editWordFamilySlot(cw.layer2) === slot)) count++;
    }
  }
  if (typeof editObjectStamps === 'function') {
    var ostamps = editObjectStamps();
    for (var k = 0; k < ostamps.length; k++) {
      var ow = editStampWords(palette, ostamps[k]);
      if (ow && (editWordFamilySlot(ow.layer1) === slot || editWordFamilySlot(ow.layer2) === slot)) count++;
    }
  }
  var groups = d.groups || [];
  for (var m = 0; m < groups.length; m++) {
    var og = groups[m];
    if (og.uid === excludeUid) continue;
    var gcells = og.cells || [];
    for (var n = 0; n < gcells.length; n++) {
      var part = gcells[n];
      if (editWordFamilySlot(part.layer1) === slot || editWordFamilySlot(part.layer2) === slot) count++;
    }
  }
  return count;
}

function widgetArtStyle(a, w, h, target) {
  if (!a) return '';
  var size = target || 30;
  var pxW = (w || 2) * 16, pxH = (h || 2) * 16;
  var n = 1;
  while (pxW / n > 48 || pxH / n > 48) n *= 2;
  var dw = Math.floor(pxW / n), dh = Math.floor(pxH / n);
  var sx = a.x + Math.floor((48 - dw) / 2) - Math.floor((size - dw) / 2);
  var sy = a.y + Math.floor((48 - dh) / 2) - Math.floor((size - dh) / 2);
  return 'background-image:url(' + a.uri + ');background-position:-' + sx + 'px -' + sy + 'px;background-repeat:no-repeat;';
}

/** Switch the variation of a placed widget on the map. One undo step. */
function placedSetVariation(palette, uid, varIdx) {
  var g = editGroupFind(uid);
  if (!g) return;
  if (editLocked()) {
    editNote('this map is locked — unlock it to change what is placed on it');
    renderEditChrome(); return;
  }
  var w = placedFindWidget(g);
  if (!w) return;
  if (typeof widgetEnsureVariations === 'function') widgetEnsureVariations(w);
  if (!w.variations || !w.variations[varIdx]) return;
  var v = w.variations[varIdx];
  var c = typeof widgetConstruct === 'function' ? widgetConstruct(w, varIdx) : null;
  if (!c) return;

  // Replace, never add: the slots only this widget used are freed before
  // the new colouring takes one, so switching #115 → #35 leaves one slot
  // spent, not two — and undo puts both back (one step, slots included).
  editBegin();
  var oldCells = g.cells, obj = placedGroupObject(g);
  var oldFrames = obj ? obj.frames : null, oldLayer = obj ? obj.layer : null;
  var famSnap = editFamiliesSnapshot();
  var gSlots = [];
  oldCells.forEach(function (part) {
    [part.layer1, part.layer2].forEach(function (word) {
      var s = word == null ? -1 : editWordFamilySlot(word);
      if (s >= 0 && gSlots.indexOf(s) < 0) gSlots.push(s);
    });
  });
  (oldFrames || []).forEach(function (f) {
    Object.keys(f || {}).forEach(function (k) {
      var w = editStampWords(palette, f[k]);
      [w && w.layer1, w && w.layer2].forEach(function (word) {
        var s = word == null ? -1 : editWordFamilySlot(word);
        if (s >= 0 && gSlots.indexOf(s) < 0) gSlots.push(s);
      });
    });
  });
  // Off the map while the slots are counted, so its own cells do not hold them.
  g.cells = [];
  if (obj) { obj.frames = []; obj.layer = {}; }
  var fams = editFamilies(), auto = editAutoFamilies();
  gSlots.forEach(function (s) {
    if (fams[s] === undefined || editSlotUsageCount(palette, s, g.uid) !== 0) return;
    fams[s] = undefined;
    delete auto[s];
  });

  var got = typeof editConstructParts === 'function' ? editConstructParts(palette, c, g.x, g.y) : null;
  if (!got || (!got.parts.length && c.cells && c.cells.length)) {
    g.cells = oldCells;
    if (obj) { obj.frames = oldFrames; obj.layer = oldLayer; }
    editFamiliesRestore(famSnap);
    editEnd();
    if (got && got.problems && got.problems.length) editNote('cannot switch variation: ' + got.problems.join(', '));
    renderEditChrome();
    return;
  }
  g.cells = got.parts;
  g.variation = v.id;
  g.variationIdx = varIdx;
  g.widget = w.id;
  g.name = c.name;
  if (obj) {
    var oSpec = c.attachments && c.attachments.objects && c.attachments.objects[0];
    var objFrames = !oSpec ? null : (oSpec.frames && oSpec.frames.length) ? oSpec.frames
      : (oSpec.cells && oSpec.cells.length ? [oSpec.cells] : []);
    if (objFrames) {
      var frameLayers = objFrames.map(function (cells) { return editObjectLayerFrom(cells, g.level); });
      if (typeof objectNormalizeFrames === 'function') frameLayers = objectNormalizeFrames(frameLayers);
      obj.frames = frameLayers;
      obj.states = frameLayers.length + 1;
      if (obj.activeFrame >= obj.states) obj.activeFrame = 0;
    } else {
      obj.frames = oldFrames;
    }
    obj.layer = obj.activeFrame >= 1 ? (obj.frames[obj.activeFrame - 1] || {}) : {};
  }
  editEnd();
  editNote('switched ' + g.name + ' to variation ' + v.name);
  requestComposedPreview();
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function placedRowHtml(g, n) {
  var sel = g.uid === _groupSel, locked = editLocked(), parts = placedPartsText(g);
  var w = placedFindWidget(g);
  if (w && typeof widgetEnsureVariations === 'function') widgetEnsureVariations(w);
  var vars = (w && w.variations) || [];
  var hasVars = vars.length > 1;
  var obj = placedGroupObject(g);
  var objFrames = obj && typeof editObjectFrames === 'function' ? editObjectFrames(obj) : [];
  var hasObjStates = !hasVars && obj && (objFrames.length > 0 || (obj.states && obj.states > 1));
  var hasChips = hasVars || hasObjStates;
  var open = hasChips && placedIsOpen(g, hasChips);

  var title = g.name + ' — ' + g.w + '×' + g.h + ' at ' + g.x + ',' + g.y + (parts ? ', with ' + parts : '')
    + '\ndrawn #' + n + ': a later row is drawn over an earlier one'
    + (locked ? '' : '\nclick to select · drag ⠿ to reorder');

  var chipsHtml = '';
  if (open) {
    chipsHtml = '<div class="rg-object-expanded"><div class="ro-chips">';
    if (hasVars) {
      // By id first: a library widget's list can lose a colouring the ROM
      // never attested (widgetEnsureVariations), which shifts the indices.
      var curIdx = g.variation ? vars.findIndex(function (v) { return v.id === g.variation; }) : -1;
      if (curIdx < 0) curIdx = g.variationIdx != null && g.variationIdx < vars.length ? g.variationIdx : 0;
      vars.forEach(function (v, idx) {
        var on = idx === curIdx;
        var vKey = w.id + ':' + v.id;
        var vArt = _widgetArt && (_widgetArt[vKey] || _widgetArt[w.id]);
        chipsHtml += '<button class="ro-chip' + (on ? ' sel' : '') + '" data-placed-var-uid="' + g.uid
          + '" data-placed-var-idx="' + idx + '" title="Variation ' + escH(v.name) + '">'
          + '<i class="ro-img rg-widget-var-thumb" data-widget-art="' + escH(vKey) + '" data-w="' + (w.w || 2) + '" data-h="' + (w.h || 2) + '" style="'
          + widgetArtStyle(vArt, w.w, w.h, 30) + '"></i>'
          + '<span class="ro-lbl">' + escH(v.name) + '</span></button>';
      });
    } else if (hasObjStates) {
      var active = obj.activeFrame || 0;
      chipsHtml += '<button class="ro-chip' + (active === 0 ? ' sel' : '') + '" data-placed-obj-uid="' + obj.uid
        + '" data-placed-obj-frame="0" title="State 0">' + objectFrameThumb(obj, 0, _editOrigin)
        + '<span class="ro-lbl">0</span></button>';
      for (var f = 1; f <= objFrames.length; f++) {
        chipsHtml += '<button class="ro-chip' + (active === f ? ' sel' : '') + '" data-placed-obj-uid="' + obj.uid
          + '" data-placed-obj-frame="' + f + '" title="Frame ' + f + '">' + objectFrameThumb(obj, f, _editOrigin)
          + '<span class="ro-lbl">' + f + '</span></button>';
      }
    }
    chipsHtml += '</div></div>';
  }

  var caretHtml = '';
  if (hasChips) {
    caretHtml = '<span class="rg-object-caret" data-placed-toggle="' + g.uid + '" title="'
      + (open ? 'Hide' : 'Show') + ' variations">' + (open ? '▾' : '▸') + '</span>';
  }

  return '<div class="rg-object-card rg-placed-card' + (sel ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-placed-row' + (sel ? ' on' : '') + '"' + (locked ? '' : ' draggable="true"')
    + ' data-placed-sel="' + g.uid + '" title="' + escH(title) + '">'
    + (locked ? '' : '<span class="rg-trigger-grip" aria-hidden="true">⠿</span>')
    + objectWhereSvg(g) + objectFrameThumb(g, 0, _editOrigin, 'rg-trigger-tiles')
    + '<span class="rg-trigger-label">#' + n + ' · ' + escH(g.name)
    + '<span class="rg-trigger-what">' + g.w + '×' + g.h + ' at ' + g.x + ',' + g.y + (parts ? ' · ' + escH(parts) : '') + '</span></span>'
    + caretHtml
    + (locked ? '' : '<button class="rdf rdf-xs" data-placed-disband="' + g.uid + '" title="Disband: write it into the map, and '
      + 'let its triggers and objects go — each is then edited on its own">disband</button>'
      + '<button class="rdf rg-trigger-remove" data-placed-remove="' + g.uid + '" title="Remove it, with its triggers and objects">×</button>')
    + '</div>'
    + chipsHtml + (typeof placedTimingHtml === 'function' ? placedTimingHtml(g) : '')
    + '</div>';
}

/** The Placed list: every stamped widget, in draw order. */
function placedListHtml() {
  if (typeof requestWidgets === 'function') requestWidgets();
  if (typeof ensureWidgetPreviews === 'function') ensureWidgetPreviews();
  var d = editDraft();
  var list = (d && d.groups) || [];
  var html = '<div class="rs-note">What you stamped, in draw order — a later row is drawn over an earlier one. '
    + 'Each is locked together with its triggers and objects: move or remove it whole, or disband it to edit its parts.</div>'
    + '<div class="rg-trigger-list rg-placed-list">';
  if (!list.length) html += '<div class="rs-note">none yet — arm a widget in Library and click the map</div>';
  list.forEach(function (g, i) { html += placedRowHtml(g, i); });
  return html + '</div>';
}

/** A click the Placed list owns (map-editor-input.js). */
function placedClick(t) {
  var ds = t.dataset;
  if (ds.placedToggle) {
    var tog = editGroupFind(Number(ds.placedToggle));
    if (tog) {
      _placedOpen[placedOpenKey(tog)] = !placedIsOpen(tog, true);
      renderEditChrome();
      return true;
    }
  }
  if (ds.placedVarIdx != null && ds.placedVarUid != null) {
    placedSetVariation(_mtPalette, Number(ds.placedVarUid), Number(ds.placedVarIdx));
    return true;
  }
  if (ds.placedObjFrame != null && ds.placedObjUid != null) {
    if (typeof objectSelectFrame === 'function') {
      objectSelectFrame(Number(ds.placedObjFrame), Number(ds.placedObjUid));
    }
    return true;
  }
  if ((ds.placedRemove || ds.placedDisband) && editLocked()) {
    editNote('this map is locked — unlock it to change what is placed on it'); renderEditChrome(); return true;
  }
  if (ds.placedRemove) {
    if (editGroupDelete(Number(ds.placedRemove))) requestComposedPreview();
    renderEditChrome(); return true;
  }
  if (ds.placedDisband) {
    if (editGroupDisband(_mtPalette, Number(ds.placedDisband))) requestComposedPreview();
    renderEditChrome(); return true;
  }
  if (ds.placedSel) {
    var g = editGroupFind(Number(ds.placedSel));
    if (!g) return true;
    if (typeof editDeselectAll === 'function') editDeselectAll();
    _groupSel = g.uid;
    editNote(g.name + ' selected — drag it on the map with the Select tool, Delete to remove it');
    renderEditChrome(); return true;
  }
  return false;
}

// ── order ──────────────────────────────────────────────────────────────────

/** Move group `uid` to just before `beforeUid` (the end, on top, when null). One undo step. */
function placedReorder(uid, beforeUid) {
  var d = editDraft();
  var g = editGroupFind(uid);
  if (!d || !g || uid === beforeUid) return;
  if (editLocked()) { editNote('this map is locked — unlock it to reorder what is placed on it'); renderEditChrome(); return; }
  var rest = d.groups.filter(function (x) { return x !== g; });
  var at = beforeUid == null ? rest.length : rest.indexOf(editGroupFind(beforeUid));
  if (at < 0) at = rest.length;
  rest.splice(at, 0, g);
  if (rest.every(function (x, i) { return x === d.groups[i]; })) return;
  editBegin();
  d.groups = rest;
  editEnd();
  editNote(g.name + ' now drawn #' + at);
  requestComposedPreview();
  renderEditChrome();
}

function placedDropRow(el) {
  return el && el.closest ? el.closest('.rg-placed-row[data-placed-sel]') : null;
}

function setupPlacedRowDrag() {
  if (typeof document === 'undefined' || !document.addEventListener || document._rgPlacedDrag) return;
  document._rgPlacedDrag = true;
  document.addEventListener('dragstart', function (e) {
    var row = placedDropRow(e.target);
    if (!row) return;
    _placedDragRow = Number(row.getAttribute('data-placed-sel'));
    row.classList.add('rg-dragging');
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'placed:' + _placedDragRow); }
  });
  document.addEventListener('dragover', function (e) {
    if (_placedDragRow == null) return;
    var row = placedDropRow(e.target);
    var list = !row && e.target && e.target.closest ? e.target.closest('.rg-placed-list') : null;
    if (!row && !list) return;
    e.preventDefault();
    triggerDropClear();
    (row || list).classList.add(row ? 'rg-drop-before' : 'rg-drop-on');
  });
  document.addEventListener('drop', function (e) {
    if (_placedDragRow == null) return;
    var uid = _placedDragRow, row = placedDropRow(e.target);
    _placedDragRow = null;
    triggerDropClear();
    e.preventDefault();
    placedReorder(uid, row ? Number(row.getAttribute('data-placed-sel')) : null);
  });
  document.addEventListener('dragend', function () {
    _placedDragRow = null;
    triggerDropClear();
  });
}

setupPlacedRowDrag();
