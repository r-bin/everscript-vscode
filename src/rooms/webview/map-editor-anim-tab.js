// Ownership: the Animation tab — its rows (one per animated tile on the
// map), the open row's patterns, frames and ticks, and what the pencil and
// eraser do on this tab. The model is map-editor-animations.js; the purple on
// the map is map-editor-anim-map.js.
//
// A row, closed: where the tile is in the room, how it looks now (playing),
// its pattern letter — A, B, C… for vanilla's patterns, `custom` otherwise —
// or how many of its frames are tiled. Open: the patterns (vanilla's, only
// for vanilla's frames), then each frame with its hold in 60 Hz ticks.
//
// The pencil:
//   - on a cell of the open tile: its open frame gets the Tile tab's brush —
//     every frame needs a tile before it works;
//   - with a row's `place` armed: places that animated tile, like a tile;
//   - anywhere else: a new animated tile, two empty (purple) frames, placed
//     where you drag, and opened on frame 0.
// Vanilla's animated tiles are locked to their frames until disbanded, as a
// placed widget is. The eraser takes an animated tile off a cell.
//
// Owns: _animStroke, _animPlace, _animSelPart.

/** `{mode: 'place'|'tile'|'erase', uid}` while a pencil or eraser gesture is down. */
var _animStroke = null;
/** The animated tile a row's `place` armed for the pencil, or null. */
var _animPlace = null;
/** A cell of the open row's placement: which of an animated tile's rows is open. */
var _animSelPart = null;

/** This row is the open one: its tile, and the placement the open cell is in (else its first). */
function animRowOpen(entry) {
  if (entry.g.uid !== _animSel) return false;
  var inAny = _animSelPart != null && editAnimsListed(_mtPalette).some(function (x) {
    return x.g.uid === _animSel && x.cells.indexOf(_animSelPart) >= 0;
  });
  return inAny ? entry.cells.indexOf(_animSelPart) >= 0 : entry.part === 0;
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

/** Where its cells are, on a thumbnail of the room (the Object rows' look). */
function animWhereSvg(cells) {
  var W = _mtPalette && _mtPalette.widthTiles, H = _mtPalette && _mtPalette.heightTiles;
  if (!W || !H) return '';
  var org = _editOrigin;
  return '<svg class="rg-trigger-where" viewBox="' + org.x + ' ' + org.y + ' ' + (W * EDIT_UNITS) + ' ' + (H * EDIT_UNITS)
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g class="rg-trigger-where-map"><use href="#rg-img"/><use href="#rg-edit-tiles"/></g>'
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

function animPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

/** Its pattern as a chip: the letter, `custom`, or how far its frames are tiled. */
function animBadgeHtml(e, presets) {
  if (!editAnimComplete(e)) {
    var done = e.frames.filter(function (g) { return g != null; }).length;
    return '<span class="rg-anim-badge empty" title="every frame needs a tile before it animates">' + done + '/' + e.frames.length + ' tiled</span>';
  }
  var letter = editAnimLetter(e, presets);
  return letter ? '<span class="rg-anim-badge" title="vanilla’s pattern ' + letter + ': ' + escH(e.delays.join(' ')) + ' ticks">' + letter + '</span>'
    : '<span class="rg-anim-badge custom" title="' + escH(e.delays.join(' ')) + ' ticks">custom</span>';
}

function animRowHtml(entry, locked) {
  var e = entry.g, open = animRowOpen(entry), fam = animFamilyOf(e, entry.cells);
  var presets = editAnimPresets(e);
  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-anim-sel="' + e.uid + '" data-anim-part="' + (entry.cells[0] || '') + '" title="'
    + escH((e.rom ? 'the room’s own' : e.vanilla ? 'vanilla’s frames' : 'drawn here') + (e.vanilla ? ' · locked until disbanded' : '')
      + '\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells) + animPreviewHtml(e, fam, 30, entry.cells)
    + '<span class="rg-trigger-label">' + (e.frames[0] != null ? e.frames[0] : 'new animated tile') + (e.vanilla ? ' <span class="rg-anim-lock" aria-label="locked">🔒</span>' : '')
    + '<span class="rg-trigger-what">' + animPlural(editAnimRuns(e).length, 'frame') + ' · ' + animPlural(entry.cells.length, 'cell')
      + (entry.parts > 1 ? ' · <span title="every copy changes together: frames and ticks are shared">' + (entry.part + 1) + ' of ' + entry.parts + '</span>' : '') + '</span></span>'
    + animBadgeHtml(e, presets)
    + (locked || !editAnimComplete(e) ? '' : '<button class="rdf rdf-xs' + (_animPlace === e.uid ? ' on' : '') + '" data-anim-act="place" data-anim-uid="' + e.uid
      + '" title="' + (_animPlace === e.uid ? 'Stop placing it' : 'Place it with the pencil, like a tile — every copy changes together') + '">place</button>')
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-anim-act="delete" data-anim-uid="' + e.uid
      + '" title="Stop it: its tiles stay, still on frame 0">×</button>')
    + '</div>';
  if (open) html += animOpenHtml(e, fam, presets, locked, entry.cells);
  return html + '</div>';
}

/** The open row: patterns, then each frame with its ticks, the countdown, and what can be done. */
function animOpenHtml(e, fam, presets, locked, cells) {
  var dis = locked ? ' disabled' : '';
  var letter = editAnimComplete(e) ? editAnimLetter(e, presets) : null;
  var html = '<div class="rg-object-expanded rg-anim-timing">';
  if (presets.length) {
    html += '<div class="rg-anim-presets"><span class="rg-anim-timing-lbl">pattern</span>';
    presets.forEach(function (t, i) {
      html += '<button class="ro-chip rg-anim-preset' + (t.letter === letter ? ' sel' : '') + '" data-anim-preset="' + i + '"' + dis
        + ' title="' + escH('vanilla’s pattern ' + t.letter + ': ' + t.delays.join(' ') + ' ticks, on ' + animPlural(t.channels, 'channel')) + '">'
        + t.letter + '</button>';
    });
    html += '<span class="ro-chip rg-anim-preset custom' + (letter ? '' : ' sel') + '" title="your own ticks — set them below">custom</span></div>';
  }
  html += '<div class="ro-chips">';
  // One chip per graphic held in a row (editAnimRuns): 10 frames of 127 ticks read as one of 1270.
  editAnimRuns(e).forEach(function (r, k) {
    var t = r.ticks, on = _animFrame >= r.start && _animFrame < r.start + r.count;
    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (on ? ' sel' : '') + (r.graphic == null ? ' rg-anim-empty' : '') + '" data-anim-frame="' + r.start + '" title="Frame ' + k
      + (r.count > 1 ? ' — ' + r.count + ' frames of at most ' + ANIM_MAX_TICKS + ' ticks in the ROM' : '')
      + (e.vanilla ? ' — locked: disband to change its tiles' : ' — the pencil on one of its cells tiles it') + '">'
      + animFrameSwatchHtml(r.graphic, fam, cells, r.start) + '<span class="ro-lbl">' + k + '</span></button>'
      + '<input type="number" class="rg-anim-ticks" min="1" value="' + t + '" data-anim-delay="' + k
      + '" aria-label="Frame ' + k + ' hold in ticks" title="Hold in 60 Hz ticks (' + Math.round(t * 1000 / 60) + ' ms)'
      + (t > ANIM_MAX_TICKS ? ' — stored as ' + Math.ceil(t / ANIM_MAX_TICKS) + ' frames of at most ' + ANIM_MAX_TICKS : '') + '"' + dis + '/>'
      + '</div>';
  });
  html += '</div><div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (_animPlaying ? ' on' : '') + '" data-anim-act="play" title="' + (_animPlaying ? 'Stop, and show the open frame' : 'Play it on the map') + '">'
    + (_animPlaying ? '■ Stop' : '▶ Play') + '</button>'
    + '<label>start after <input type="number" class="rg-anim-ticks" min="0" max="255" value="' + (e.init || 0)
    + '" data-anim-init="1" title="Initial countdown in ticks — shifts it against the others"' + dis + '/> ticks</label>';
  if (!locked && !e.vanilla) {
    html += '<button class="rdf rdf-xs" data-anim-act="add-frame" title="Add an empty frame — tile it before it works">+ Frame</button>'
      + (editAnimRuns(e).length > 2 && _animFrame > 0 ? '<button class="rdf rdf-xs" data-anim-act="del-frame" title="Remove the open frame">− Frame</button>' : '');
  }
  if (!locked && e.vanilla) html += '<button class="rdf rdf-xs" data-anim-act="disband" title="Unlock its frames to change them — it is your own from then on">disband</button>';
  return html + '</div></div>';
}

/** The tab. */
function animTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var listed = editAnimsListed(p), locked = editLocked();
  var used = editAnimChannels(p).length;
  var html = '<div class="rs-note">An animated tile changes over time; every cell showing it changes together. '
    + 'The pencil places one — a new one starts as empty purple frames, each needing a tile. ▶ tiles from the Tile tab are the same thing, ready-made.</div>'
    + '<div class="rg-anim-head"><button class="rdf rdf-xs' + (_animOff ? '' : ' on') + '" data-anim-act="toggle-off" aria-pressed="' + !_animOff + '"'
    + ' title="Animation on the whole map: off shows every animated tile on its first frame">Animation: ' + (_animOff ? 'off' : 'on') + '</button>'
    + (locked ? '' : '<button class="rdf rdf-xs" data-anim-act="new" title="Close the open one: the pencil then places a new, empty animated tile">+ New animated tile</button>')
    + '<span class="rg-anim-budget' + (used > 42 ? ' over' : '') + '">' + animPlural(used, 'channel') + ' of 42</span></div>'
    + '<div class="rg-trigger-list rg-anim-list">';
  if (!listed.length) html += '<div class="rs-note">no animated tiles on this map yet</div>';
  listed.forEach(function (e) { html += animRowHtml(e, locked); });
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
  if (ds.animAct === 'place') {
    var pu = Number(ds.animUid);
    _animPlace = _animPlace === pu ? null : pu;
    if (_animPlace != null) { _animSel = pu; editNote('the pencil places it — every copy changes together'); }
    animRedraw(); return true;
  }
  if (ds.animSel) {
    var uid = Number(ds.animSel), part = ds.animPart || null;
    var wasOpen = _animSel === uid && editAnimsListed(_mtPalette).some(function (x) { return x.g.uid === uid && animRowOpen(x) && x.cells[0] === (part || undefined); });
    _animSel = wasOpen ? null : uid;
    _animSelPart = wasOpen ? null : part;
    if (_animPlace !== _animSel) _animPlace = null;
    _animFrame = 0; _animPlaying = false;
    animRedraw(); return true;
  }
  if (ds.animFrame != null) { _animFrame = Number(ds.animFrame); _animPlaying = false; animRedraw(); return true; }
  if (ds.animAct === 'play') { _animPlaying = !_animPlaying; animRedraw(); return true; }
  if (ds.animAct === 'toggle-off') { editAnimToggleOff(); animRedraw(); return true; }
  if (ds.animAct === 'new') { _animSel = null; _animPlace = null; _animFrame = 0; editNote('the pencil places a new animated tile'); animRedraw(); return true; }
  if (!ds.animAct && ds.animPreset == null) return false;
  if (editLocked()) { editNote('this map is locked — unlock it to change its animations'); renderEditChrome(); return true; }
  var e = editAnimFind(ds.animUid ? Number(ds.animUid) : _animSel);
  if (!e) return true;
  editBegin();
  if (ds.animPreset != null) {
    var t2 = editAnimPresets(e)[Number(ds.animPreset)];
    if (t2) { e.delays = t2.delays.slice(); editNote('vanilla’s pattern ' + t2.letter + ': ' + t2.delays.join(' ') + ' ticks'); }
  } else if (ds.animAct === 'delete') {
    editAnims().splice(editAnims().indexOf(e), 1);
    if (_animSel === e.uid) _animSel = null;
    editNote('stopped — its tiles show frame 0, still');
  } else if (ds.animAct === 'disband') {
    e.vanilla = false;
    editNote('disbanded — its frames are yours to change');
  } else if (ds.animAct === 'add-frame' && !e.vanilla) {
    e.frames.push(null);
    e.delays.push(e.delays[e.delays.length - 1] || 8);
    _animFrame = e.frames.length - 1;
    editNote('frame ' + _animFrame + ' added — tile it with the pencil on one of its cells');
  } else if (ds.animAct === 'del-frame' && !e.vanilla && _animFrame > 0 && editAnimRuns(e).length > 2) {
    var run = editAnimRunAt(e, _animFrame);
    e.frames.splice(run.start, run.count);
    e.delays.splice(run.start, run.count);
    _animFrame = Math.min(run.start, e.frames.length - 1);
  }
  editEnd();
  animRedraw();
  return true;
}

/** Tick and countdown fields (map-editor-input.js's input/change events). */
function animInputHandler(ev) {
  var t = ev && ev.target;
  if (!t || !t.dataset || (t.dataset.animDelay == null && !t.dataset.animInit)) return false;
  var e = editAnimFind(_animSel);
  if (!e || editLocked() || ev.type !== 'change') return true;
  var v = Math.max(t.dataset.animInit ? 0 : 1, Math.min(t.dataset.animInit ? 255 : ANIM_MAX_TICKS * 64, Number(t.value) | 0));
  editBegin();
  if (t.dataset.animInit) e.init = v; else editAnimSetRunTicks(e, Number(t.dataset.animDelay), v);
  editEnd();
  animRedraw();
  return true;
}

// ── the pencil and the eraser ─────────────────────────────────────────────

/** The animated tile a cell shows (either layer), or one placed there before it had a tile. */
function animAt(cell) {
  var p = _mtPalette, k = editKey(cell.x, cell.y);
  var w = editStampWords(p, editCellAt(p, cell.x, cell.y));
  var e = w ? (editWordAnim(p, w.layer1) || editWordAnim(p, w.layer2)) : null;
  if (e) return e;
  var list = editAnims();
  for (var i = 0; i < list.length; i++) if ((list[i].pending || []).indexOf(k) >= 0) return list[i];
  return null;
}

/** The stamp a cell shows, or -1 (a custom map's untouched cell). */
function animCellIndex(cell) { return editCellAt(_mtPalette, cell.x, cell.y); }

/** Put animated tile `e` on `cell`: its word on its layer, or (no tile for frame 0 yet) pending. */
function animPlace(e, cell) {
  var p = _mtPalette, k = editKey(cell.x, cell.y);
  if (e.slot == null) {
    e.pending = e.pending || [];
    if (e.pending.indexOf(k) < 0) e.pending.push(k);
    return;
  }
  var w = editStampWords(p, animCellIndex(cell));
  // A custom map's untouched cell has no stamp: it is the empty one, blank on both layers.
  if (!w) w = { layer1: editBlankCanopy(p), layer2: editBlankCanopy(p), collision: 0 };
  var word = animWordFor(e, e.slot);
  var canopy = e.layer === 'canopy';
  if ((canopy ? w.layer1 : w.layer2) === word) return;
  editApply([{ x: cell.x, y: cell.y, index: editAddStamp(p, {
    layer1: canopy ? word : w.layer1, layer2: canopy ? w.layer2 : word, collision: w.collision }) }]);
}

/** Take an animated tile off `cell`: the canopy goes blank, the ground back to the floor (or a still frame 0). */
function animUnplace(e, cell) {
  var p = _mtPalette, d = editDraft(), k = editKey(cell.x, cell.y);
  if (e.pending && e.pending.indexOf(k) >= 0) { e.pending.splice(e.pending.indexOf(k), 1); return; }
  var w = editStampWords(p, editCellAt(p, cell.x, cell.y));
  if (!w || e.slot == null) return;
  var canopy = animWordSlot(w.layer1) === e.slot && w.layer1 !== editBlankCanopy(p);
  // A custom map's ground goes back to empty; a ROM room's to frame 0, still.
  var still = d.blank ? editBlankCanopy(p)
    : (editSlotChr(editAdoptGraphic(p, e.frames[0], null)) | ((e.pal || 0) & 0xfc00)) & 0xffff;
  editApply([{ x: cell.x, y: cell.y, index: editAddStamp(p, {
    layer1: canopy ? editBlankCanopy(p) : w.layer1, layer2: canopy ? w.layer2 : still, collision: w.collision }) }]);
}

/**
 * Frame `k` of `e` gets the Tile tab's brush. Frame 0 is the slot's own
 * graphic, so tiling it gives `e` a new slot and moves every cell showing
 * `e` onto it (and puts down the ones placed before it had a tile).
 */
function animTile(e, k) {
  var p = _mtPalette, d = editDraft(), blank = editBlankCanopy(p);
  if (e.vanilla) { editNote('its frames are vanilla’s and locked — disband it (open row) to change them'); return; }
  var b = d.brush >= 0 ? editStampWords(p, d.brush) : null;
  if (!b) { editNote('pick a tile on the Tile tab first — the pencil puts it into frame ' + k); return; }
  var canopy = b.layer1 !== blank, bw = canopy ? b.layer1 : b.layer2;
  var graphic = editSlotGraphicId(p, animWordSlot(bw));
  if (graphic == null) return;
  if (!e.layer) e.layer = canopy ? 'canopy' : 'terrain';
  if (k === 0 || e.pal == null) e.pal = bw & 0xfc00;
  // A frame held over several (editAnimRuns) takes the tile in each.
  var run = editAnimRunAt(e, k) || { start: k, count: 1 };
  var fill = function () { for (var i = run.start + 1; i < run.start + run.count; i++) e.frames[i] = graphic; };
  if (k !== 0) { e.frames[k] = graphic; fill(); return; }
  if (e.slot != null && e.frames[0] === graphic && !(e.pending || []).length) return;
  var cells = (editAnimCellMap(p)[e.uid] || []).slice();
  e.frames[0] = graphic;
  fill();
  e.pending = [];
  editAdoptGraphic(p, graphic, e.uid, true);
  cells.forEach(function (key) { var c = key.split(',').map(Number); animPlace(e, { x: c[0], y: c[1] }); });
}

/** A gesture on the Animation tab. Returns true when it was this tab's. */
function editAnimGesture(d, cell, phase) {
  var open = editAnimFind(_animSel);
  if (d.tool === 'select') {
    if (phase !== 'down') return false;
    var at = animAt(cell);
    if (!at) return false;
    _animSel = at.uid; _animSelPart = editKey(cell.x, cell.y); _animFrame = 0; _animPlaying = false; renderEditChrome(); return true;
  }
  if (d.tool !== 'paint' && d.tool !== 'erase') return false;
  if (phase === 'down') {
    editBegin();
    _animPlaying = false;
    if (d.tool === 'erase') {
      var hit = open && animAt(cell) === open ? open : animAt(cell);
      _animStroke = { mode: 'erase', uid: hit ? hit.uid : (open ? open.uid : null) };
      if (hit) animUnplace(hit, cell);
    } else if (open && animAt(cell) === open && _animPlace !== open.uid) {
      _animStroke = { mode: 'tile', uid: open.uid };
      animTile(open, _animFrame);
    } else {
      var armed = _animPlace != null ? editAnimFind(_animPlace) : null;
      var e = armed || editAnimNew({});
      if (!armed) { _animSel = e.uid; _animSelPart = editKey(cell.x, cell.y); _animFrame = 0; }
      _animStroke = { mode: 'place', uid: e.uid };
      animPlace(e, cell);
    }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (!_animStroke) return false;
  var s = editAnimFind(_animStroke.uid);
  if (phase !== 'up') {
    if (s && _animStroke.mode === 'place') animPlace(s, cell);
    if (s && _animStroke.mode === 'erase' && animAt(cell) === s) animUnplace(s, cell);
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  var placedNew = _animStroke.mode === 'place' && s && s.slot == null && s.frames.every(function (g) { return g == null; });
  _animStroke = null;
  editEnd();
  if (placedNew) editNote('a new animated tile, opened — pick a tile on the Tile tab, then click one of its purple cells to tile frame ' + _animFrame);
  animRedraw();
  return true;
}
