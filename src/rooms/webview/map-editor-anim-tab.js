// Ownership: the Animation tab — its rows, the timing editor in the open
// row, what the pencil does on this tab, and the outlines it draws on the
// map. The model is map-editor-animations.js.
//
// One row per animation. Its timings (the groups that show the same
// cycles) are chips under its header, A, B, C…, always visible: a chip
// opens that timing, `+` adds one (the same animation on slots of its own,
// so tiles can run out of step). The open timing shows vanilla's own
// timings for this animation as presets — only when vanilla runs exactly
// these frames — then each frame with its hold in 60 Hz ticks, the initial
// countdown, + Frame / − Frame, and Play. While a timing is open and not
// playing, its tiles show the frame being drawn.
//
// The pencil on this tab:
//   - drags out a rectangle: a new, empty animation over it (an object
//     with timings), opened on frame 0;
//   - with a drawn animation open, paints the open frame inside its
//     rectangle with the Tile tab's brush. A cell gets a slot of its own
//     where its frames differ from the other cells', because a slot changes
//     for every tile on it (the game's own rule). The eraser sets a frame
//     back to the one before it.
//
// Owns: _animDraw, _animPainting.

var _animDraw = null, _animPainting = false;

/** A graphic's swatch from its family's sheet (map-editor-families.js), or an empty box. */
function animSwatchHtml(graphic, family, size) {
  var box = '<i class="rg-anim-sw" style="width:' + size + 'px;height:' + size + 'px"';
  var s = typeof _famSheets !== 'undefined' ? _famSheets[family] : null;
  if (!s || s === 'pending' || !s.slots) {
    if (typeof ensureFamilySheet === 'function' && family != null) ensureFamilySheet(family);
    return box + '></i>';
  }
  var at = -1;
  for (var i = 0; i < s.slots.length; i++) if (s.slots[i][2] === graphic) { at = i; break; }
  if (at < 0) return box + ' title="graphic ' + graphic + '"></i>';
  var k = size / s.cell;
  return '<i class="rg-anim-sw" title="graphic ' + graphic + '" style="width:' + size + 'px;height:' + size + 'px;background-image:url('
    + s.imageUri + ');background-size:' + (s.imageWidth * k) + 'px ' + (s.imageHeight * k) + 'px;background-position:-'
    + ((at % s.columns) * s.cell * k) + 'px -' + (Math.floor(at / s.columns) * s.cell * k) + 'px"></i>';
}

/** The family a group is drawn in: off the first of its cells that names one of its slots. */
function animFamilyOf(g, cells) {
  var p = _mtPalette, fams = editFamilies();
  for (var i = 0; i < Math.min(cells.length, 8); i++) {
    var c = cells[i].split(',').map(Number);
    var w = editStampWords(p, editCellAt(p, c[0], c[1]));
    if (!w) continue;
    var words = [w.layer1, w.layer2];
    for (var j = 0; j < 2; j++) {
      if (editAnimOfSlot(p, animWordSlot(words[j])) === g) {
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
  return lo === Infinity ? null : lo;
}

function animPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

/** The preset a group's ticks match (`-1`: custom). */
function animPresetMatch(g, presets) {
  var key = g.delays.join(',');
  for (var i = 0; i < presets.length; i++) if (presets[i].delays.join(',') === key) return i;
  return -1;
}

function animRowHtml(row, locked) {
  var first = row.timings[0].g;
  var open = row.timings.filter(function (e) { return e.g.uid === _animSel; })[0];
  var cells = row.timings.reduce(function (n, e) { return n + e.cells.length; }, 0);
  var chans = Object.keys(first.channels);
  var fam = animFamilyOf(first, row.timings.reduce(function (a, e) { return a.concat(e.cells); }, []));
  var lo = animLowest(first);
  var presets = editAnimPresets(first);
  var src = first.rom ? 'the room’s own' : first.auto ? 'from ▶ tiles' : 'drawn here';
  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-anim-sel="' + (open ? open.g.uid : first.uid) + '"'
    + ' title="' + escH(src + ' · ' + animPlural(row.timings.length, 'timing') + '\nclick to ' + (open ? 'close' : 'open its timing')) + '">'
    + (chans.length ? animSwatchHtml(first.channels[chans[0]][0], fam, 30) : '<i class="rg-anim-sw rg-anim-sw-new" style="width:30px;height:30px">▶</i>')
    + '<span class="rg-trigger-label">' + (lo != null ? lo : 'new animation')
    + '<span class="rg-trigger-what">' + animPlural(first.delays.length, 'frame') + ' · ' + animPlural(cells, 'cell')
    + (first.area ? ' · ' + first.area.w + '×' + first.area.h + ' at ' + first.area.x + ',' + first.area.y : '') + '</span></span>'
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-anim-act="delete-all" data-anim-uid="' + first.uid
      + '" title="Stop this animation, every timing: its tiles stay, still on frame 0">×</button>')
    + '</div>';
  // The timings, always shown: a chip per timing, vanilla's marked.
  html += '<div class="rg-anim-timings"><span class="rg-anim-timing-lbl">timing</span>';
  row.timings.forEach(function (e, i) {
    var v = animPresetMatch(e.g, presets) >= 0;
    html += '<button class="ro-chip rg-anim-letter-chip' + (e.g.uid === _animSel ? ' sel' : '') + (v ? ' vanilla' : '')
      + '" data-anim-sel="' + e.g.uid + '" data-anim-keep="1" title="' + escH('timing ' + ANIM_LETTERS[i] + ': ' + e.g.delays.join(' ')
      + ' ticks' + (e.g.init ? ', starts after ' + e.g.init : '') + (v ? ' — vanilla’s' : ' — custom') + ' · ' + animPlural(e.cells.length, 'cell')) + '">'
      + ANIM_LETTERS[i] + '</button>';
  });
  if (!locked) html += '<button class="ro-chip rg-anim-letter-chip rg-anim-add" data-anim-act="new-timing" data-anim-uid="'
    + (open ? open.g.uid : first.uid) + '" title="Another timing of this animation, on slots of its own: tiles picked or switched to it run out of step">+</button>';
  html += '</div>';
  if (open) html += animTimingHtml(open.g, fam, presets, locked, row.timings.length);
  return html + '</div>';
}

/** The open timing: vanilla's presets, a hold per frame, the countdown, frames added or taken, Play. */
function animTimingHtml(g, fam, presets, locked, count) {
  var chans = Object.keys(g.channels);
  var first = chans.length ? g.channels[chans[0]] : [];
  var dis = locked ? ' disabled' : '';
  var match = animPresetMatch(g, presets);
  var html = '<div class="rg-object-expanded rg-anim-timing">';
  if (presets.length) {
    html += '<div class="rg-anim-presets"><span class="rg-anim-timing-lbl">ticks</span>'
      + '<button class="ro-chip rg-anim-preset' + (match < 0 ? ' sel' : '') + '" disabled title="Your own ticks — edit them below">custom</button>';
    presets.forEach(function (t, i) {
      html += '<button class="ro-chip rg-anim-preset vanilla' + (i === match ? ' sel' : '') + '" data-anim-preset="' + i + '"' + dis
        + ' title="' + escH('vanilla runs these frames at ' + t.delays.join(' ') + ' ticks on ' + animPlural(t.channels, 'channel')) + '">'
        + '<b>v</b> ' + t.delays.join(' ') + '</button>';
    });
    html += '</div>';
  }
  html += '<div class="ro-chips">';
  g.delays.forEach(function (t, k) {
    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (k === _animFrame ? ' sel' : '') + '" data-anim-frame="' + k + '" title="Frame ' + k
      + (g.area ? ' — the pencil paints it' : '') + '">'
      + (first[k] != null ? animSwatchHtml(first[k], fam, 30) : '<i class="rg-anim-sw" style="width:30px;height:30px"></i>')
      + '<span class="ro-lbl">' + k + '</span></button>'
      + '<input type="number" class="rg-anim-ticks" min="1" max="255" value="' + t + '" data-anim-delay="' + k
      + '" aria-label="Frame ' + k + ' hold in ticks" title="Hold in 60 Hz ticks (' + Math.round(t * 1000 / 60) + ' ms)"' + dis + '/>'
      + '</div>';
  });
  html += '</div><div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (_animPlaying ? ' on' : '') + '" data-anim-act="play" title="' + (_animPlaying ? 'Stop, and show the open frame' : 'Play it on the map') + '">'
    + (_animPlaying ? '■ Stop' : '▶ Play') + '</button>'
    + '<label>start after <input type="number" class="rg-anim-ticks" min="0" max="255" value="' + (g.init || 0)
    + '" data-anim-init="1" title="Initial countdown in ticks — shifts this timing against the others"' + dis + '/> ticks</label>';
  if (!locked) {
    html += '<button class="rdf rdf-xs" data-anim-act="add-frame" title="Add a frame showing what the last one shows">+ Frame</button>'
      + (g.delays.length > 1 && _animFrame > 0 ? '<button class="rdf rdf-xs" data-anim-act="del-frame" title="Remove frame ' + _animFrame + '">− Frame</button>' : '')
      + (count > 1 ? '<button class="rdf rdf-xs" data-anim-act="delete" data-anim-uid="' + g.uid + '" title="Remove this timing: its tiles stay, still">Remove timing</button>' : '');
  }
  return html + '</div></div>';
}

/** The tab. */
function animTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var rows = editAnimRows(p), locked = editLocked();
  var used = editAnimChannels(p).length;
  var html = '<div class="rs-note">Every tile of a timing changes together, as one channel does in the game. '
    + 'Drag out a rectangle with the pencil for a new animation and paint its frames; ▶ tiles from the Tile tab land here on their own.</div>'
    + '<div class="rs-note rg-anim-budget' + (used > 42 ? ' over' : '') + '">' + animPlural(used, 'channel')
    + ' of 42 — the most any vanilla room runs</div><div class="rg-trigger-list rg-anim-list">';
  if (!rows.length) html += '<div class="rs-note">no animations on this map yet</div>';
  rows.forEach(function (r) { html += animRowHtml(r, locked); });
  return html + '</div>';
}

// ── clicks and inputs ─────────────────────────────────────────────────────

function animRedraw() {
  requestComposedPreview();
  renderEditChrome();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

function animClick(t) {
  var ds = t.dataset;
  if (ds.animTiming) { placedSetTiming(Number(ds.animGroup), Number(ds.animTiming)); animRedraw(); return true; }
  if (ds.animSel) {
    var uid = Number(ds.animSel);
    _animSel = _animSel === uid && !ds.animKeep ? null : uid;
    _animFrame = 0; _animPlaying = false;
    animRedraw(); return true;
  }
  if (ds.animFrame != null) { _animFrame = Number(ds.animFrame); _animPlaying = false; animRedraw(); return true; }
  if (ds.animAct === 'play') { _animPlaying = !_animPlaying; animRedraw(); return true; }
  if (!ds.animAct && ds.animPreset == null) return false;
  if (editLocked()) { editNote('this map is locked — unlock it to change its animations'); renderEditChrome(); return true; }
  var g = editAnimFind(ds.animUid ? Number(ds.animUid) : _animSel);
  if (!g) return true;
  editBegin();
  if (ds.animPreset != null) {
    var t2 = editAnimPresets(g)[Number(ds.animPreset)];
    if (t2) { g.delays = t2.delays.slice(); editNote('vanilla’s timing: ' + t2.delays.join(' ') + ' ticks'); }
  } else if (ds.animAct === 'delete' || ds.animAct === 'delete-all') {
    var kind = animKind(g);
    var gone = ds.animAct === 'delete' ? [g] : editAnims().filter(function (x) { return x === g || (kind && animKind(x) === kind); });
    gone.forEach(function (x) { editAnims().splice(editAnims().indexOf(x), 1); });
    if (gone.some(function (x) { return x.uid === _animSel; })) _animSel = null;
    editNote('stopped — its tiles show frame 0, still');
  } else if (ds.animAct === 'add-frame') {
    g.delays.push(g.delays[g.delays.length - 1] || 8);
    Object.keys(g.channels).forEach(function (s) { var q = g.channels[s]; q.push(q[q.length - 1]); });
    _animFrame = g.delays.length - 1;
    editNote('frame ' + _animFrame + ' added' + (g.area ? ' — paint it with the pencil' : ''));
  } else if (ds.animAct === 'del-frame' && _animFrame > 0 && g.delays.length > 1) {
    g.delays.splice(_animFrame, 1);
    Object.keys(g.channels).forEach(function (s) { g.channels[s].splice(_animFrame, 1); });
    _animFrame = Math.min(_animFrame, g.delays.length - 1);
  } else if (ds.animAct === 'new-timing') {
    var copy = editAnimNew(g.delays, g.init, g.auto ? { auto: true } : {});
    Object.keys(g.channels).forEach(function (s) {
      var seq = g.channels[s];
      var slot = editAdoptGraphic(_mtPalette, seq[0], copy.uid, true);
      if (slot >= 0) copy.channels[slot] = seq.slice();
    });
    _animSel = copy.uid; _animFrame = 0;
    editNote('another timing of this animation — change its ticks; tiles picked or switched to it (Placed list) run at it');
  }
  editEnd();
  animRedraw();
  return true;
}

/** Tick and countdown fields (map-editor-input.js's input/change events). */
function animInputHandler(e) {
  var t = e && e.target;
  if (!t || !t.dataset || (t.dataset.animDelay == null && !t.dataset.animInit)) return false;
  var g = editAnimFind(_animSel);
  if (!g || editLocked() || e.type !== 'change') return true;
  var v = Math.max(t.dataset.animInit ? 0 : 1, Math.min(255, Number(t.value) | 0));
  editBegin();
  if (t.dataset.animInit) g.init = v; else g.delays[Number(t.dataset.animDelay)] = v;
  editEnd();
  animRedraw();
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

function animInArea(g, cell) {
  var a = g && g.area;
  return !!a && cell.x >= a.x && cell.y >= a.y && cell.x < a.x + a.w && cell.y < a.y + a.h;
}

/** Whether any shown cell but `cell` names `slot`. */
function animSlotShared(g, slot, cell) {
  var p = _mtPalette, here = editKey(cell.x, cell.y);
  return (editAnimCellMap(p)[g.uid] || []).some(function (k) {
    if (k === here) return false;
    var c = k.split(',').map(Number), w = editStampWords(p, editCellAt(p, c[0], c[1]));
    return !!w && (animWordSlot(w.layer1) === slot || animWordSlot(w.layer2) === slot);
  });
}

/**
 * Frame `k` of drawn animation `g` at `cell` shows the brush's graphic (on the
 * brush's layer), or — `erase` — what frame k-1 shows. A cell whose frames
 * would differ from another cell's on the same slot gets a slot of its own;
 * frame 0 is the slot's graphic itself, so painting it takes a new slot too.
 * Part of the gesture's undo step.
 */
function animPaintFrame(g, cell, k, erase) {
  var p = _mtPalette, d = editDraft(), blank = editBlankCanopy(p);
  var b = d.brush >= 0 ? editStampWords(p, d.brush) : null;
  if (!erase && !b) { editNote('pick a tile on the Tile tab first — the pencil paints its graphic into this frame'); return; }
  var canopy = erase ? !!animSlotAt(cell, 'canopy') : b.layer1 !== blank;
  var bw = b ? (canopy ? b.layer1 : b.layer2) : null;
  var w = editStampWords(p, editCellAt(p, cell.x, cell.y));
  if (!w) return;
  var word = canopy ? w.layer1 : w.layer2;
  var s = animWordSlot(word), ours = editAnimOfSlot(p, s) === g;
  var seq = ours ? g.channels[s].slice() : g.delays.map(function () { return editSlotGraphicId(p, s); });
  if (erase) { if (!ours || k < 1) return; seq[k] = seq[k - 1]; }
  else seq[k] = editSlotGraphicId(p, animWordSlot(bw));
  if (seq[k] == null) return;
  if (ours && k > 0 && !animSlotShared(g, s, cell)) { g.channels[s] = seq; return; }
  // A slot of its own: one of this animation's with exactly these frames, else a fresh one.
  var ns = -1;
  for (var sl in g.channels) if (g.channels[sl].join(',') === seq.join(',') && editAnimOfSlot(p, Number(sl)) === g) { ns = Number(sl); break; }
  if (ns < 0) { ns = editAdoptGraphic(p, seq[0], g.uid, true); if (ns < 0) return; g.channels[ns] = seq; }
  // Family and mirror: the brush's when it sets frame 0 (or the cell had no art there), else the cell's.
  var src = (!erase && (k === 0 || word === blank)) ? bw : word;
  var nw = (editSlotChr(ns) | (src & 0xfc00)) & 0xffff;
  editApply([{ x: cell.x, y: cell.y, index: editAddStamp(p, { layer1: canopy ? nw : w.layer1, layer2: canopy ? w.layer2 : nw, collision: w.collision }) }]);
  if (ours && !animSlotShared(g, s, { x: -1, y: -1 })) delete g.channels[s];
}

/** A new, empty animation over `box`, opened on frame 0. Part of the gesture's undo step. */
function editAnimFromRect(box) {
  var g = editAnimNew([8], 0, { area: { x: box.x1, y: box.y1, w: box.x2 - box.x1 + 1, h: box.y2 - box.y1 + 1 } });
  _animSel = g.uid; _animFrame = 0; _animPlaying = false;
  editNote('a new animation, ' + g.area.w + '×' + g.area.h + ' — paint frame 0 with the pencil, then + Frame and paint the next');
  return g;
}

/** A gesture on the Animation tab. Returns true when it was this tab's. */
function editAnimGesture(d, cell, phase) {
  var g = editAnimFind(_animSel);
  if (d.tool === 'select') {
    if (phase !== 'down') return false;
    var at = animSlotAt(cell, 'canopy') || animSlotAt(cell, 'terrain');
    if (!at) return false;
    _animSel = at.g.uid; _animPlaying = false; renderEditChrome(); return true;
  }
  if (d.tool !== 'paint' && d.tool !== 'erase') return false;
  var erase = d.tool === 'erase';
  if (phase === 'down') {
    if (animInArea(g, cell)) {
      editBegin(); _animPainting = true; _animPlaying = false;
      animPaintFrame(g, cell, _animFrame, erase);
      renderEditLayer(_mtPalette, _editComposed, _editOrigin);
      return true;
    }
    if (erase) { editNote('the eraser sets a frame back to the one before it, inside an open drawn animation'); return true; }
    _animDraw = { ax: cell.x, ay: cell.y, x1: cell.x, y1: cell.y, x2: cell.x, y2: cell.y };
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (_animPainting) {
    if (phase !== 'up') { if (animInArea(g, cell)) animPaintFrame(g, cell, _animFrame, erase); }
    else { editEnd(); _animPainting = false; animRedraw(); return true; }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (_animDraw) {
    _animDraw.x1 = Math.min(_animDraw.ax, cell.x); _animDraw.x2 = Math.max(_animDraw.ax, cell.x);
    _animDraw.y1 = Math.min(_animDraw.ay, cell.y); _animDraw.y2 = Math.max(_animDraw.ay, cell.y);
    if (phase === 'up') {
      var box = _animDraw; _animDraw = null;
      editBegin(); editAnimFromRect(box); editEnd();
      animRedraw(); return true;
    }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  return false;
}

/** Outlines on the map while the tab is open: drawn animations' rectangles, every timing's cells, the open one brighter. */
function editAnimSvg(origin) {
  if (typeof _editActiveTab === 'undefined' || _editActiveTab !== 'anim' || !_mtPalette) return '';
  var html = '';
  var rect = function (x, y, w, h, cls) {
    var a = editCellPos(origin, x, y);
    return '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + (w * EDIT_UNITS) + '" height="' + (h * EDIT_UNITS) + '" pointer-events="none"/>';
  };
  editAnimsListed(_mtPalette).forEach(function (e) {
    var sel = e.g.uid === _animSel ? ' sel' : '';
    if (e.g.area) html += rect(e.g.area.x, e.g.area.y, e.g.area.w, e.g.area.h, 'rg-obj-area rg-anim-area' + sel);
    e.cells.forEach(function (k) { var c = k.split(',').map(Number); html += rect(c[0], c[1], 1, 1, 'rg-anim-cell' + sel); });
  });
  if (_animDraw) html += rect(_animDraw.x1, _animDraw.y1, _animDraw.x2 - _animDraw.x1 + 1, _animDraw.y2 - _animDraw.y1 + 1, 'rg-obj-area rg-obj-drag');
  return html;
}
