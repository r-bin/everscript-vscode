// Ownership: the Animation tab — its rows (one per animated tile on the
// map), the open row's patterns, frames and ticks, what the pencil and
// eraser do on this tab, and the purple marks on the map. The model is
// map-editor-animations.js.
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
// Owns: _animStroke, _animPlace.

/** `{mode: 'place'|'tile'|'erase', uid}` while a pencil or eraser gesture is down. */
var _animStroke = null;
/** The animated tile a row's `place` armed for the pencil, or null. */
var _animPlace = null;

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

/** How it looks now: its frames played at its ticks, or frame 0 while animation is off or it is unfinished. */
function animPreviewHtml(e, family, size) {
  if (_animOff || !editAnimComplete(e)) return animSwatchHtml(e.frames[0], family, size);
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
  var e = entry.g, open = e.uid === _animSel, fam = animFamilyOf(e, entry.cells);
  var presets = editAnimPresets(e);
  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-anim-sel="' + e.uid + '" title="'
    + escH((e.rom ? 'the room’s own' : e.vanilla ? 'vanilla’s frames' : 'drawn here') + (e.vanilla ? ' · locked until disbanded' : '')
      + '\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells) + animPreviewHtml(e, fam, 30)
    + '<span class="rg-trigger-label">' + (e.frames[0] != null ? e.frames[0] : 'new animated tile') + (e.vanilla ? ' <span class="rg-anim-lock" aria-label="locked">🔒</span>' : '')
    + '<span class="rg-trigger-what">' + animPlural(e.frames.length, 'frame') + ' · ' + animPlural(entry.cells.length, 'cell') + '</span></span>'
    + animBadgeHtml(e, presets)
    + (locked || !editAnimComplete(e) ? '' : '<button class="rdf rdf-xs' + (_animPlace === e.uid ? ' on' : '') + '" data-anim-act="place" data-anim-uid="' + e.uid
      + '" title="' + (_animPlace === e.uid ? 'Stop placing it' : 'Place it with the pencil, like a tile — every copy changes together') + '">place</button>')
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-anim-act="delete" data-anim-uid="' + e.uid
      + '" title="Stop it: its tiles stay, still on frame 0">×</button>')
    + '</div>';
  if (open) html += animOpenHtml(e, fam, presets, locked);
  return html + '</div>';
}

/** The open row: patterns, then each frame with its ticks, the countdown, and what can be done. */
function animOpenHtml(e, fam, presets, locked) {
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
  e.delays.forEach(function (t, k) {
    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (k === _animFrame ? ' sel' : '') + (e.frames[k] == null ? ' rg-anim-empty' : '') + '" data-anim-frame="' + k + '" title="Frame ' + k
      + (e.vanilla ? ' — locked: disband to change its tiles' : ' — the pencil on one of its cells tiles it') + '">'
      + animSwatchHtml(e.frames[k], fam, 30) + '<span class="ro-lbl">' + k + '</span></button>'
      + '<input type="number" class="rg-anim-ticks" min="1" max="255" value="' + t + '" data-anim-delay="' + k
      + '" aria-label="Frame ' + k + ' hold in ticks" title="Hold in 60 Hz ticks (' + Math.round(t * 1000 / 60) + ' ms)"' + dis + '/>'
      + '</div>';
  });
  html += '</div><div class="rg-anim-bar">'
    + '<button class="rdf rdf-xs' + (_animPlaying ? ' on' : '') + '" data-anim-act="play" title="' + (_animPlaying ? 'Stop, and show the open frame' : 'Play it on the map') + '">'
    + (_animPlaying ? '■ Stop' : '▶ Play') + '</button>'
    + '<label>start after <input type="number" class="rg-anim-ticks" min="0" max="255" value="' + (e.init || 0)
    + '" data-anim-init="1" title="Initial countdown in ticks — shifts it against the others"' + dis + '/> ticks</label>';
  if (!locked && !e.vanilla) {
    html += '<button class="rdf rdf-xs" data-anim-act="add-frame" title="Add an empty frame — tile it before it works">+ Frame</button>'
      + (e.frames.length > 2 && _animFrame > 0 ? '<button class="rdf rdf-xs" data-anim-act="del-frame" title="Remove frame ' + _animFrame + '">− Frame</button>' : '');
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
    var uid = Number(ds.animSel);
    _animSel = _animSel === uid ? null : uid;
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
  } else if (ds.animAct === 'del-frame' && !e.vanilla && _animFrame > 0 && e.frames.length > 2) {
    e.frames.splice(_animFrame, 1);
    e.delays.splice(_animFrame, 1);
    _animFrame = Math.min(_animFrame, e.frames.length - 1);
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
  var v = Math.max(t.dataset.animInit ? 0 : 1, Math.min(255, Number(t.value) | 0));
  editBegin();
  if (t.dataset.animInit) e.init = v; else e.delays[Number(t.dataset.animDelay)] = v;
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

/** Put animated tile `e` on `cell`: its word on its layer, or (no tile for frame 0 yet) pending. */
function animPlace(e, cell) {
  var p = _mtPalette, k = editKey(cell.x, cell.y);
  if (e.slot == null) {
    e.pending = e.pending || [];
    if (e.pending.indexOf(k) < 0) e.pending.push(k);
    return;
  }
  var w = editStampWords(p, editCellAt(p, cell.x, cell.y));
  if (!w) return;
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
  var still = d.blank && d.blank.floor ? d.blank.floor.layer2
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
  if (k !== 0) { e.frames[k] = graphic; return; }
  if (e.slot != null && e.frames[0] === graphic && !(e.pending || []).length) return;
  var cells = (editAnimCellMap(p)[e.uid] || []).slice();
  e.frames[0] = graphic;
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
    _animSel = at.uid; _animFrame = 0; _animPlaying = false; renderEditChrome(); return true;
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
      if (!armed) { _animSel = e.uid; _animFrame = 0; }
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

/**
 * Purple on the map. Always: a cell whose animated tile is not finished (its
 * frames still need tiles). On this tab: every animated tile's cells, the
 * open one brighter.
 */
function editAnimSvg(origin) {
  if (!_mtPalette || !editAnims().length) return '';
  var onTab = typeof _editActiveTab !== 'undefined' && _editActiveTab === 'anim';
  var html = '';
  editAnimsListed(_mtPalette).forEach(function (entry) {
    var e = entry.g, unfinished = !editAnimComplete(e);
    if (!onTab && !unfinished) return;
    var cls = 'rg-anim-cell' + (unfinished ? ' empty' : '') + (e.uid === _animSel ? ' sel' : '');
    entry.cells.forEach(function (k) {
      var c = k.split(',').map(Number), a = editCellPos(origin, c[0], c[1]);
      html += '<rect class="' + cls + '" x="' + a.x + '" y="' + a.y + '" width="' + EDIT_UNITS + '" height="' + EDIT_UNITS + '" pointer-events="none"/>';
    });
  });
  return html;
}
