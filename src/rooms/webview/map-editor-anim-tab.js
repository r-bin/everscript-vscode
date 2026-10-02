// Ownership: the Animation tab — its rows, the timing editor in the open
// row, what the pencil does on this tab, and the outlines it draws on the
// map. The model is map-editor-animations.js.
//
// A row is an animation group, named by its lowest graphic and told apart
// from the same animation at another timing by a letter (A, B, C). Outside
// the open row that letter is all the timing shown. The open row is the
// timing editor: each frame with its hold in 60 Hz ticks, the initial
// countdown, + Frame, − Frame, and "new timing".
//
// The pencil on this tab:
//   - drags out a rectangle, which becomes a new group: the top art of each
//     cell in it (canopy, else ground) moves to slots of the group's own, so
//     the rest of the map stays still;
//   - with a group open on frame 1 or later, paints that frame: the cell's
//     slot (on the brush's layer) shows the brush's graphic at that frame —
//     for every cell on that slot, which is how the game does it.
//
// Owns: _animDraw, _animPainting.

var _animDraw = null, _animPainting = false;

/** A graphic's swatch from its family's sheet (map-editor-families.js), or an empty box. */
function animSwatchHtml(graphic, family, size) {
  var s = typeof _famSheets !== 'undefined' ? _famSheets[family] : null;
  if (!s || s === 'pending' || !s.slots) {
    if (typeof ensureFamilySheet === 'function' && family != null) ensureFamilySheet(family);
    return '<i class="rg-anim-sw" style="width:' + size + 'px;height:' + size + 'px"></i>';
  }
  var at = -1;
  for (var i = 0; i < s.slots.length; i++) if (s.slots[i][2] === graphic) { at = i; break; }
  if (at < 0) return '<i class="rg-anim-sw" style="width:' + size + 'px;height:' + size + 'px" title="graphic ' + graphic + '"></i>';
  var k = size / s.cell;
  return '<i class="rg-anim-sw" title="graphic ' + graphic + '" style="width:' + size + 'px;height:' + size + 'px;background-image:url('
    + s.imageUri + ');background-size:' + (s.imageWidth * k) + 'px ' + (s.imageHeight * k) + 'px;background-position:-'
    + ((at % s.columns) * s.cell * k) + 'px -' + (Math.floor(at / s.columns) * s.cell * k) + 'px"></i>';
}

/** The family a group's first channel is drawn in: off the first cell that names it. */
function animFamilyOf(g, cells) {
  var p = _mtPalette;
  var fams = editFamilies();
  for (var i = 0; i < Math.min(cells.length, 8); i++) {
    var c = cells[i].split(',').map(Number);
    var w = editStampWords(p, editCellAt(p, c[0], c[1]));
    if (!w) continue;
    var words = [w.layer1, w.layer2];
    for (var j = 0; j < 2; j++) {
      if (g.channels[animWordSlot(words[j])] && editAnimOfSlot(p, animWordSlot(words[j])) === g) {
        var pal = (words[j] >> 10) & 7;
        if (pal >= 1) return fams[pal - 1];
      }
    }
  }
  return undefined;
}

function animLowest(g) {
  var lo = Infinity;
  Object.keys(g.channels).forEach(function (s) { lo = Math.min(lo, g.channels[s][0]); });
  return lo === Infinity ? '—' : lo;
}

function animRowHtml(e, letter, locked) {
  var g = e.g, n = g.delays.length, sel = g.uid === _animSel;
  var chans = Object.keys(g.channels);
  var first = chans.length ? g.channels[chans[0]] : null;
  var fam = animFamilyOf(g, e.cells);
  var src = g.rom ? 'the room’s own' : g.auto ? 'from a ▶ tile' : 'drawn here';
  var html = '<div class="rg-object-card rg-anim-card' + (sel ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (sel ? ' on' : '') + '" data-anim-sel="' + g.uid + '" title="'
    + escH('timing ' + letter + ' · ' + src + ' · ' + chans.length + ' slot' + (chans.length === 1 ? '' : 's')
      + ', ' + e.cells.length + ' cell' + (e.cells.length === 1 ? '' : 's') + '\nclick to open its timing') + '">'
    + (first ? animSwatchHtml(first[0], fam, 30) : '<i class="rg-anim-sw" style="width:30px;height:30px"></i>')
    + '<span class="rg-trigger-label">' + animLowest(g) + ' · <b class="rg-anim-letter">' + letter + '</b>'
    + '<span class="rg-trigger-what">' + n + ' frame' + (n === 1 ? '' : 's') + ' · ' + e.cells.length + ' cells</span></span>'
    + '<span class="rg-object-caret">' + (sel ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-anim-act="delete" data-anim-uid="' + g.uid
      + '" title="Stop animating: its tiles stay, as still frame 0">×</button>')
    + '</div>';
  if (sel) html += animTimingHtml(g, fam, locked);
  return html + '</div>';
}

/** The open row's timing editor: a hold per frame, the countdown, frames added or taken. */
function animTimingHtml(g, fam, locked) {
  var chans = Object.keys(g.channels);
  var first = chans.length ? g.channels[chans[0]] : [];
  var dis = locked ? ' disabled' : '';
  var html = '<div class="rg-object-expanded rg-anim-timing"><div class="ro-chips">';
  g.delays.forEach(function (t, k) {
    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (k === _animFrame ? ' sel' : '') + '" data-anim-frame="' + k + '" title="'
      + (k ? 'Frame ' + k + ' — the pencil paints it' : 'Frame 0 is the map itself — paint it on the Tile tab') + '">'
      + (first[k] != null ? animSwatchHtml(first[k], fam, 30) : '') + '<span class="ro-lbl">' + k + '</span></button>'
      + '<input type="number" class="rg-anim-ticks" min="1" max="255" value="' + t + '" data-anim-delay="' + k
      + '" aria-label="Frame ' + k + ' hold in ticks" title="Hold in 60 Hz ticks (' + Math.round(t * 1000 / 60) + ' ms)"' + dis + '/>'
      + '</div>';
  });
  html += '</div><div class="rg-anim-bar">'
    + '<label>start after <input type="number" class="rg-anim-ticks" min="0" max="255" value="' + (g.init || 0)
    + '" data-anim-init="1" title="Initial countdown in ticks — shifts this timing against the others"' + dis + '/> ticks</label>';
  if (!locked) {
    html += '<button class="rdf rdf-xs" data-anim-act="add-frame" title="Add a frame showing what the last one shows">+ Frame</button>'
      + (g.delays.length > 1 && _animFrame > 0 ? '<button class="rdf rdf-xs" data-anim-act="del-frame" title="Remove frame ' + _animFrame + '">− Frame</button>' : '')
      + '<button class="rdf rdf-xs" data-anim-act="new-timing" title="The same animation at a timing of its own: '
      + 'its own slots, so ▶ tiles picked while it is open play at it">New timing</button>';
  }
  return html + '</div></div>';
}

/** The tab. */
function animTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var listed = editAnimsListed(p), letters = editAnimLetters(listed), locked = editLocked();
  var used = editAnimChannels(p).length;
  var html = '<div class="rs-note">Each row moves in step: every tile on its slots changes together, as one channel does in the game. '
    + 'The pencil drags out a new one; open a row and pick frame 1 or later to paint that frame. '
    + '▶ tiles from the Tile tab land here on their own.</div>'
    + '<div class="rs-note rg-anim-budget' + (used > 42 ? ' over' : '') + '">' + used + ' channel' + (used === 1 ? '' : 's')
    + ' of 42 — the most any vanilla room runs</div><div class="rg-trigger-list rg-anim-list">';
  if (!listed.length) html += '<div class="rs-note">no animations on this map yet</div>';
  listed.forEach(function (e) { html += animRowHtml(e, letters[e.g.uid], locked); });
  return html + '</div>';
}

// ── clicks and inputs ─────────────────────────────────────────────────────

function animClick(t) {
  var ds = t.dataset;
  if (ds.animTiming) {
    placedSetTiming(Number(ds.animGroup), Number(ds.animTiming));
    renderEditChrome(); renderEditLayer(_mtPalette, _editComposed, _editOrigin); return true;
  }
  if (ds.animSel) {
    var uid = Number(ds.animSel);
    _animSel = _animSel === uid ? null : uid;
    _animFrame = 0;
    renderEditChrome(); return true;
  }
  if (ds.animFrame != null) { _animFrame = Number(ds.animFrame); renderEditChrome(); return true; }
  if (!ds.animAct) return false;
  if (editLocked()) { editNote('this map is locked — unlock it to change its animations'); renderEditChrome(); return true; }
  var g = editAnimFind(ds.animUid ? Number(ds.animUid) : _animSel);
  if (!g) return true;
  editBegin();
  if (ds.animAct === 'delete') {
    editAnims().splice(editAnims().indexOf(g), 1);
    if (_animSel === g.uid) _animSel = null;
    editNote('stopped — its tiles show frame 0, still');
  } else if (ds.animAct === 'add-frame') {
    g.delays.push(g.delays[g.delays.length - 1] || 8);
    Object.keys(g.channels).forEach(function (s) { var q = g.channels[s]; q.push(q[q.length - 1]); });
    _animFrame = g.delays.length - 1;
    editNote('frame ' + _animFrame + ' added — paint it with the pencil');
  } else if (ds.animAct === 'del-frame' && _animFrame > 0 && g.delays.length > 1) {
    g.delays.splice(_animFrame, 1);
    Object.keys(g.channels).forEach(function (s) { g.channels[s].splice(_animFrame, 1); });
    _animFrame = Math.min(_animFrame, g.delays.length - 1);
  } else if (ds.animAct === 'new-timing') {
    var copy = editAnimNew(g.delays, g.init, {});
    Object.keys(g.channels).forEach(function (s) {
      var seq = g.channels[s];
      var slot = editAdoptGraphic(_mtPalette, seq[0], copy.uid);
      if (slot >= 0) copy.channels[slot] = seq.slice();
    });
    _animSel = copy.uid; _animFrame = 0;
    editNote('a new timing — change its ticks; ▶ tiles picked while it is open play at it');
  }
  editEnd();
  requestComposedPreview();
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  return true;
}

/** Tick and countdown fields (map-editor-input.js's input/change events). */
function animInputHandler(e) {
  var t = e && e.target;
  if (!t || !t.dataset || (t.dataset.animDelay == null && !t.dataset.animInit)) return false;
  var g = editAnimFind(_animSel);
  if (!g || editLocked()) return true;
  var v = Math.max(t.dataset.animInit ? 0 : 1, Math.min(255, Number(t.value) | 0));
  if (e.type !== 'change') return true;
  editBegin();
  if (t.dataset.animInit) g.init = v; else g.delays[Number(t.dataset.animDelay)] = v;
  editEnd();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  return true;
}

// ── the pencil ────────────────────────────────────────────────────────────

/** The group whose slot `cell` shows on `layer` ('canopy'|'terrain'), with that slot. */
function animSlotAt(cell, layer) {
  var w = editStampWords(_mtPalette, editCellAt(_mtPalette, cell.x, cell.y));
  if (!w) return null;
  var word = layer === 'canopy' ? w.layer1 : w.layer2;
  var g = editWordAnim(_mtPalette, word);
  return g ? { g: g, slot: animWordSlot(word) } : null;
}

/** Paint frame `_animFrame` of the open group at `cell` with the brush's graphic. */
function animPaintFrame(g, cell) {
  var d = editDraft();
  var b = d.brush >= 0 ? editStampWords(_mtPalette, d.brush) : null;
  if (!b) { editNote('pick a tile on the Tile tab first — the pencil paints its graphic into this frame'); return; }
  var canopy = b.layer1 !== editBlankCanopy(_mtPalette);
  var at = animSlotAt(cell, canopy ? 'canopy' : 'terrain');
  if (!at || at.g !== g) { editNote('that tile is not part of this animation — drag out a group over it first'); return; }
  var graphic = editSlotGraphicId(_mtPalette, animWordSlot(canopy ? b.layer1 : b.layer2));
  if (graphic == null) return;
  g.channels[at.slot][_animFrame] = graphic;
}

/** A rectangle's art moved to slots of a new group of its own. Part of the gesture's undo step. */
function editAnimFromRect(box) {
  var p = _mtPalette, blank = editBlankCanopy(p);
  var g = editAnimNew([8], 0, {});
  var writes = [], skipped = 0;
  for (var y = box.y1; y <= box.y2; y++) {
    for (var x = box.x1; x <= box.x2; x++) {
      if (typeof editGroupAt === 'function' && editGroupAt(x, y)) { skipped += 1; continue; }
      var i = editCellAt(p, x, y);
      var w = i >= 0 ? editStampWords(p, i) : null;
      if (!w) continue;
      var move = function (word) {
        if (word === blank || (editDraft().blank && editDraft().blank.floor && word === editDraft().blank.floor.layer2)) return word;
        var s = animWordSlot(word), graphic = editSlotGraphicId(p, s);
        if (graphic == null) return word;
        var ns = editAdoptGraphic(p, graphic, g.uid);
        if (ns < 0) return word;
        if (!g.channels[ns]) g.channels[ns] = [graphic];
        return (word & ~0x3ff & 0xffff) | ((editSlotChr(ns) + ((word & 0x3ff) - editSlotChr(s))) & 0x3ff);
      };
      // The top layer with art moves (a torch, not the wall under it; water, where nothing is over it).
      var topArt = w.layer1 !== blank;
      var l1 = topArt ? move(w.layer1) : w.layer1, l2 = topArt ? w.layer2 : move(w.layer2);
      if (l1 !== w.layer1 || l2 !== w.layer2) writes.push({ x: x, y: y, index: editAddStamp(p, { layer1: l1, layer2: l2, collision: w.collision }) });
    }
  }
  if (!writes.length) { editAnims().pop(); editNote('nothing drawn there to animate'); return; }
  editApply(writes);
  _animSel = g.uid; _animFrame = 0;
  editNote('a new animation over ' + writes.length + ' tile' + (writes.length === 1 ? '' : 's')
    + (skipped ? ' (' + skipped + ' under placed widgets left out)' : '') + ' — + Frame, then paint each frame');
}

/** A gesture on the Animation tab. Returns true when it was this tab's. */
function editAnimGesture(d, cell, phase) {
  if (d.tool === 'select') {
    if (phase !== 'down') return false;
    var at = animSlotAt(cell, 'canopy') || animSlotAt(cell, 'terrain');
    if (!at) return false;
    _animSel = at.g.uid; renderEditChrome(); return true;
  }
  if (d.tool === 'erase') { if (phase === 'down') editNote('the eraser does nothing here — × on a row stops an animation'); return true; }
  if (d.tool !== 'paint') return false;
  var g = editAnimFind(_animSel);
  if (phase === 'down') {
    if (g && _animFrame >= 1 && (animSlotAt(cell, 'canopy') || animSlotAt(cell, 'terrain'))) {
      editBegin(); _animPainting = true; animPaintFrame(g, cell); return true;
    }
    _animDraw = { ax: cell.x, ay: cell.y, x1: cell.x, y1: cell.y, x2: cell.x, y2: cell.y };
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (_animPainting) {
    if (phase !== 'up') animPaintFrame(g, cell);
    else { editEnd(); _animPainting = false; requestComposedPreview(); renderEditChrome(); }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (_animDraw) {
    _animDraw.x1 = Math.min(_animDraw.ax, cell.x); _animDraw.x2 = Math.max(_animDraw.ax, cell.x);
    _animDraw.y1 = Math.min(_animDraw.ay, cell.y); _animDraw.y2 = Math.max(_animDraw.ay, cell.y);
    if (phase === 'up') {
      var box = _animDraw; _animDraw = null;
      editBegin(); editAnimFromRect(box); editEnd();
      requestComposedPreview(); renderEditChrome();
    }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  return false;
}

/** Outlines on the map while the tab is open: every listed group's cells, the open one brighter. */
function editAnimSvg(origin) {
  if (typeof _editActiveTab === 'undefined' || _editActiveTab !== 'anim' || !_mtPalette) return '';
  var html = '';
  editAnimsListed(_mtPalette).forEach(function (e) {
    var cls = 'rg-anim-cell' + (e.g.uid === _animSel ? ' sel' : '');
    e.cells.forEach(function (k) {
      var c = k.split(',').map(Number), a = editCellPos(origin, c[0], c[1]);
      html += '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS + '" pointer-events="none"/>';
    });
  });
  if (_animDraw) {
    var b = editCellPos(origin, _animDraw.x1, _animDraw.y1);
    html += '<rect class="rg-obj-area rg-obj-drag" x="' + b.x + '" y="' + b.y + '" width="' + ((_animDraw.x2 - _animDraw.x1 + 1) * EDIT_UNITS)
      + '" height="' + ((_animDraw.y2 - _animDraw.y1 + 1) * EDIT_UNITS) + '" pointer-events="none"/>';
  }
  return html;
}
