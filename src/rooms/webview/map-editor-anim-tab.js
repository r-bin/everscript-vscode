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

function animPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

/** Its pattern as a chip: the letter, `custom`, or how far its frames are tiled. */
function animBadgeHtml(e, presets, members) {
  if (!editAnimSetComplete(e, members)) {
    var done = 0, all = 0;
    members.forEach(function (m) { all += m.frames.length; done += m.frames.filter(function (g) { return g != null; }).length; });
    return '<span class="rg-anim-badge empty" title="every frame needs a tile before it animates">' + done + '/' + all + ' tiled</span>';
  }
  var letter = editAnimLetter(e, presets);
  return letter ? '<span class="rg-anim-badge" title="vanilla’s pattern ' + letter + ': ' + escH(e.delays.join(' ')) + ' ticks">' + letter + '</span>'
    : '<span class="rg-anim-badge custom" title="' + escH(e.delays.join(' ')) + ' ticks">custom</span>';
}

function animRowHtml(entry, locked, open, many) {
  var e = entry.g, fam = animFamilyOf(e, entry.cells), set = entry.members.length > 1;
  var presets = editAnimPresets(e);
  var html = '<div class="rg-object-card rg-anim-card' + (open ? ' on' : '') + '">'
    + '<div class="rg-trigger-row rg-anim-row' + (open ? ' on' : '') + '" data-anim-sel="' + e.uid + '" data-anim-part="' + (entry.cells[0] || '') + '" title="'
    + escH((e.rom ? 'the room’s own' : e.vanilla ? 'vanilla’s frames' : 'drawn here') + (e.vanilla ? ' · locked until disbanded' : '')
      + '\nclick to ' + (open ? 'close' : 'open it')) + '">'
    + animWhereSvg(entry.cells, many) + (entry.cells.length > 1 ? animGroupSvg(entry, null, 30) : animPreviewHtml(e, fam, 30, entry.cells))
    + '<span class="rg-trigger-label">' + (set ? animPlural(entry.members.length, 'tile') + ', one timing' : e.frames[0] != null ? e.frames[0] : 'new animated tile') + (e.vanilla ? ' <span class="rg-anim-lock" aria-label="locked">🔒</span>' : '')
    + '<span class="rg-trigger-what">' + animPlural(editAnimRuns(e, entry.members).length, 'frame') + ' · ' + animPlural(entry.cells.length, 'cell')
      + (entry.parts > 1 ? ' · <span title="every copy changes together: frames and ticks are shared">' + (entry.part + 1) + ' of ' + entry.parts + '</span>' : '') + '</span></span>'
    + animBadgeHtml(e, presets, entry.members)
    + (locked || !editAnimSetComplete(e, entry.members) || set ? '' : '<button class="rdf rdf-xs' + (_animPlace === e.uid ? ' on' : '') + '" data-anim-act="place" data-anim-uid="' + e.uid
      + '" title="' + (_animPlace === e.uid ? 'Stop placing it' : 'Place it with the pencil, like a tile — every copy changes together') + '">place</button>')
    + '<span class="rg-object-caret">' + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-anim-act="delete" data-anim-uid="' + e.uid
      + '" title="Stop it: its tiles stay, still on frame 0">×</button>')
    + '</div>';
  if (open) html += animOpenHtml(entry, fam, presets, locked);
  return html + '</div>';
}

/** The open row: patterns, then each frame with its ticks, the countdown, and what can be done. */
function animOpenHtml(entry, fam, presets, locked) {
  var e = entry.g, cells = entry.cells, dis = locked ? ' disabled' : '';
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
  editAnimRuns(e, entry.members).forEach(function (r, k) {
    var t = r.ticks, on = _animFrame >= r.start && _animFrame < r.start + r.count;
    html += '<div class="rg-anim-frame-col">'
      + '<button class="ro-chip' + (on ? ' sel' : '') + (r.graphic == null ? ' rg-anim-empty' : '') + '" data-anim-frame="' + r.start + '" title="Frame ' + k
      + (r.count > 1 ? ' — ' + r.count + ' frames of at most ' + ANIM_MAX_TICKS + ' ticks in the ROM' : '')
      + (e.vanilla ? ' — locked: disband to change its tiles' : ' — the pencil on one of its cells tiles it') + '">'
      // Several tiles: each frame as the group looks then, laid out as on the map (the Object tab's frames).
      + (entry.members.length > 1 ? animGroupSvg(entry, r.start, 44) : animFrameSwatchHtml(r.graphic, fam, cells, r.start, e)) + '<span class="ro-lbl">' + k + '</span></button>'
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
      + (editAnimRuns(e, entry.members).length > 2 && _animFrame > 0 ? '<button class="rdf rdf-xs" data-anim-act="del-frame" title="Remove the open frame">− Frame</button>' : '');
  }
  if (!locked && e.vanilla) html += '<button class="rdf rdf-xs" data-anim-act="disband" title="Unlock its frames to change them — it is your own from then on">disband</button>';
  return html + '</div></div>';
}

/** The tab. */
function animTabHtml() {
  var p = _mtPalette;
  if (!p) return '<div class="rs-note">loading the tile palette…</div>';
  var listed = editAnimsListed(p), locked = editLocked(), open = animOpenEntry(listed);
  var used = editAnimChannels(p).length;
  var html = '<div class="rs-note">An animated tile changes over time; every cell showing it changes together. '
    + 'The pencil places one — a new one starts as empty purple frames, each needing a tile; drag a rectangle for several tiles on one timing (a 2×2 fan). ▶ tiles from the Tile tab are the same thing, ready-made. Cmd/Ctrl+C copies the open one, Cmd/Ctrl+V pastes it at the pointer.</div>'
    + '<div class="rg-anim-head"><button class="rdf rdf-xs' + (_animOff ? '' : ' on') + '" data-anim-act="toggle-off" aria-pressed="' + !_animOff + '"'
    + ' title="Animation on the whole map: off shows every animated tile on its first frame">Animation: ' + (_animOff ? 'off' : 'on') + '</button>'
    + (locked ? '' : '<button class="rdf rdf-xs" data-anim-act="new" title="Close the open one: the pencil then places a new, empty animated tile">+ New animated tile</button>')
    + '<span class="rg-anim-budget' + (used > 42 ? ' over' : '') + '">' + animPlural(used, 'channel') + ' of 42</span></div>'
    + '<div class="rg-trigger-list rg-anim-list">';
  if (!listed.length) html += '<div class="rs-note">no animated tiles on this map yet</div>';
  listed.forEach(function (x) { html += animRowHtml(x, locked, x === open, listed.length > 12); });
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
    var was = animOpenEntry(editAnimsListed(_mtPalette)), wasOpen = !!was && was.g.uid === uid && (was.cells[0] || null) === part;
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
  // A set's tiles share their timing and frame count: every change is all of theirs.
  var ms = editAnimGroup(e);
  editBegin();
  if (ds.animPreset != null) {
    var t2 = editAnimPresets(e)[Number(ds.animPreset)];
    if (t2) {
      ms.forEach(function (m) { if (m.frames.length === t2.delays.length) m.delays = t2.delays.slice(); });
      editNote('vanilla’s pattern ' + t2.letter + ': ' + t2.delays.join(' ') + ' ticks' + (ms.length > 1 ? ', on all ' + ms.length + ' tiles' : ''));
    }
  } else if (ds.animAct === 'delete') {
    ms.forEach(function (m) { editAnims().splice(editAnims().indexOf(m), 1); });
    if (ms.some(function (m) { return m.uid === _animSel; })) _animSel = null;
    editNote('stopped — its tiles show frame 0, still');
  } else if (ds.animAct === 'disband') {
    ms.forEach(function (m) { m.vanilla = false; });
    editNote('disbanded — its frames are yours to change');
  } else if (ds.animAct === 'add-frame' && !e.vanilla) {
    ms.forEach(function (m) { m.frames.push(null); m.delays.push(m.delays[m.delays.length - 1] || 8); });
    _animFrame = e.frames.length - 1;
    editNote('frame ' + _animFrame + ' added — tile it with the pencil on ' + (ms.length > 1 ? 'each of its cells' : 'one of its cells'));
  } else if (ds.animAct === 'del-frame' && !e.vanilla && _animFrame > 0 && editAnimRuns(e, ms).length > 2) {
    var run = editAnimRunAt(e, _animFrame, ms);
    ms.forEach(function (m) { m.frames.splice(run.start, run.count); m.delays.splice(run.start, run.count); });
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
  var ms = editAnimGroup(e);
  if (t.dataset.animInit) ms.forEach(function (m) { m.init = v; });
  else editAnimSetRunTicks(e, Number(t.dataset.animDelay), v, ms);
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
    _animSel = at.uid; _animSelPart = editKey(cell.x, cell.y); _animFrame = 0; _animPlaying = false; renderEditChrome();
    // A long list: bring its row into view.
    var row = typeof document !== 'undefined' && document.querySelector ? document.querySelector('.rg-anim-card.on') : null;
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (d.tool !== 'paint' && d.tool !== 'erase') return false;
  if (phase === 'down') {
    editBegin();
    _animPlaying = false;
    if (d.tool === 'erase') {
      var hit = open && animAt(cell) === open ? open : animAt(cell);
      _animStroke = { mode: 'erase', uid: hit ? hit.uid : (open ? open.uid : null) };
      if (hit) animUnplace(hit, cell);
    } else if (open && editAnimGroup(open).indexOf(animAt(cell)) >= 0 && _animPlace !== open.uid) {
      // A cell of the open tile, or of its set: that tile's open frame.
      _animStroke = { mode: 'tile', uid: open.uid };
      animTile(animAt(cell), _animFrame);
    } else if (_animPlace != null && editAnimFind(_animPlace)) {
      _animStroke = { mode: 'place', uid: _animPlace };
      animPlace(editAnimFind(_animPlace), cell);
    } else {
      // A new one: the rectangle dragged out, one tile per cell, on one timing (editAnimNewSet).
      _animStroke = { mode: 'rect', x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y };
    }
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  if (!_animStroke) return false;
  var s = editAnimFind(_animStroke.uid), r = _animStroke;
  if (r.mode === 'rect') { r.x1 = cell.x; r.y1 = cell.y; }
  if (phase !== 'up') {
    if (s && _animStroke.mode === 'place') animPlace(s, cell);
    if (s && _animStroke.mode === 'erase' && animAt(cell) === s) animUnplace(s, cell);
    renderEditLayer(_mtPalette, _editComposed, _editOrigin);
    return true;
  }
  var placedNew = r.mode === 'rect';
  if (placedNew) {
    s = editAnimNewSet(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.max(r.x0, r.x1), Math.max(r.y0, r.y1));
    _animSel = s.uid; _animSelPart = s.pending[0]; _animFrame = 0;
  }
  _animStroke = null;
  editEnd();
  if (placedNew) editNote('a new animated tile, opened — pick a tile on the Tile tab, then click one of its purple cells to tile frame ' + _animFrame);
  animRedraw();
  return true;
}
