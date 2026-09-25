// Ownership: custom maps — rooms that are not in the ROM, each its own entry
// under the rail's **Custom rooms** group.
//
// "a new map creates a new entry in custom rooms and shows an empty grid …
// with a debug entrance … no objects, no triggers. You can only be in the
// vanilla room list if you are a vanilla room." Before this, `new map`
// opened Strong Heart's Hut, highlighted it in the Vanilla list and drafted
// over it — so the header, the rail and every overlay said you were in his
// hut. A custom map is now a room of its own: its own row, its own name, its
// own draft, and a detail panel that never asks the host for a ROM render.
//
// It still *borrows* a donor room's graphics list and families, because a
// room with no Block 1 renders black (rule 7.1) — but only as vocabulary,
// through `_edit.roomId`, which is what every host request keys the tile
// data on. Nothing of the donor is drawn.
//
// Persisted through the host's `uiPrefs` (key `customMaps`), because the
// webview is rebuilt whenever the active document changes and a map that
// vanished with it would not be a map.
//
// Owns: _customMaps, _customActive, _customSaveTimer, _newMapWaiting.

/** The donor for a map made from `+ New Map` — see map-editor-newroom.js. */
var CUSTOM_MAP_BORROW = 0x34;
/**
 * One SNES screen: 256×224 pixels is 16×14 metatiles of 16px. The natural
 * "empty page" for a room — nothing scrolls until you make it bigger.
 */
var CUSTOM_MAP_W = 16;
var CUSTOM_MAP_H = 14;
/** The `uiPrefs` key the list is saved under. */
var CUSTOM_MAPS_PREF = 'customMaps';

/**
 * `[{key, name, borrow, w, h, saved}]`, oldest first. `saved` is the draft's
 * data (customSerialize) — the live `_edit` while the map is on screen is
 * the authority, and is folded back in by customStash on the way out.
 */
var _customMaps = [];
/** Key of the custom map on screen, or null when a ROM/.evs room is. */
var _customActive = null;
var _customSaveTimer = null;
/** Set while a custom map waits for its borrowed dictionary to arrive. */
var _newMapWaiting = false;

function customFind(key) {
  for (var i = 0; i < _customMaps.length; i++) if (_customMaps[i].key === key) return _customMaps[i];
  return null;
}

// ── the rail rows ────────────────────────────────────────────────────────────

/** The list the rows live in, created at the top of the Custom rooms group. */
function customListEl() {
  var tree = document.getElementById('rm-live-tree');
  if (!tree) return null;
  var ul = document.getElementById('rm-custom-list');
  if (!ul) {
    ul = document.createElement('ul');
    ul.className = 'rt rm-custom-list';
    ul.id = 'rm-custom-list';
    tree.insertBefore(ul, tree.firstChild);
  }
  // "No rooms found in this file" is untrue once a custom map exists.
  var empty = tree.querySelector('.rm-empty');
  if (empty) empty.hidden = _customMaps.length > 0;
  return ul;
}

function customRowHtml(m) {
  return '<li class="rn-map cm-map" data-custom="' + escH(m.key) + '"'
    + ' title="' + escH(m.name + ' — a custom map, ' + m.w + '×' + m.h + ' tiles; graphics from room 0x'
      + m.borrow.toString(16)) + '">'
    + '<span class="rn-map-label">' + escH(m.name) + '</span>'
    + '<span class="rn-vid-tag">' + m.w + '×' + m.h + '</span></li>';
}

/** Rebuild every custom row (after a load, a rename or a resize). */
function customRenderRows() {
  var ul = customListEl();
  if (!ul) return;
  ul.innerHTML = _customMaps.map(customRowHtml).join('');
  if (_customActive) {
    var li = ul.querySelector('[data-custom="' + _customActive + '"]');
    if (li) li.classList.add('rsel');
  }
}

// ── creating and opening ─────────────────────────────────────────────────────

/**
 * Make a new custom map and open it. `borrow` is the room whose graphics it
 * may draw with; `+ New Map` passes nothing and gets the default donor.
 */
/** `New map N`, one past the highest N in `maps`. */
function customNextName(maps) {
  var n = 1;
  maps.forEach(function (m) {
    var k = /^New map (\d+)$/.exec(m.name);
    if (k) n = Math.max(n, Number(k[1]) + 1);
  });
  return 'New map ' + n;
}

function customNew(w, h, borrow) {
  var name = customNextName(_customMaps);
  var m = {
    key: 'custom-' + Date.now().toString(36) + '-' + name.slice(8),
    name: name,
    borrow: typeof borrow === 'number' ? borrow : CUSTOM_MAP_BORROW,
    w: w || CUSTOM_MAP_W, h: h || CUSTOM_MAP_H,
    saved: null,
  };
  _customMaps.push(m);
  customRenderRows();
  customSave();
  customOpen(m.key);
  return m;
}

/** What renderRoomDetail draws for a custom map: a named, empty canvas. */
function customRoomDetail(m) {
  return {
    name: m.name,
    custom: m.key,
    // Where the tile data comes from — the only thing the donor is for.
    romRoomId: m.borrow,
    relPath: 'custom map · graphics from room 0x' + m.borrow.toString(16) + ' · not in any .evs file yet',
    content: { initMap: { x1: 0, y1: 0, x2: m.w * 2, y2: m.h * 2 } },
  };
}

/** Select a custom map's row and put it on screen. */
function customOpen(key) {
  var m = customFind(key);
  if (!m) return;
  var tab = document.querySelector('.tab[data-tab="rooms"]');
  if (tab && !tab.classList.contains('active')) tab.click();
  if (typeof railSetGroup === 'function') railSetGroup('live', true);
  customStash();
  document.querySelectorAll('.rn-map.rsel').forEach(function (x) { x.classList.remove('rsel'); });
  var li = document.querySelector('[data-custom="' + key + '"]');
  if (li) {
    li.classList.add('rsel');
    if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }
  _customActive = key;
  renderRoomDetail(customRoomDetail(m));
}

/**
 * The draft renderRoomDetail should edit for this custom map: the one it
 * had, or a new one. Called from renderRoomDetail in place of editReset.
 */
function customBindDraft(room) {
  var m = customFind(room.custom);
  var d = editReset(m ? m.borrow : room.romRoomId);
  d.customKey = room.custom;
  // No families: a new map's seven slots are its own to fill, and picking a
  // tile adopts its family (map-editor-rules §1). The donor's seven are not
  // the map's — pre-filled, they left no free slot, so the Tile tab showed
  // only those seven and nothing else could be drawn.
  d.families = [];
  if (m && m.saved) customRestore(d, m.saved);
  return d;
}

/**
 * After the panel is built: edit mode on, then ask for the borrowed
 * dictionary. The blank room itself waits for it (customPaletteReady).
 */
function customAfterRender(room) {
  var d = editDraft();
  if (d && !d.on) {
    var btn = document.getElementById('rg-edit-btn');
    if (btn) btn.click(); else editToggle(room, null);
  }
  // Always a fresh request: `_mtPalette` outlives a room change, and a
  // custom map drawing with the previous room's dictionary would name the
  // wrong graphics in every word.
  _mtPalette = null;
  _newMapWaiting = true;
  requestMetatilePalette(room, _mtLayer);
}

/** The borrowed dictionary arrived (metatile-palette.js); draft the grid. */
function newMapPaletteReady() {
  if (!_newMapWaiting) return;
  _newMapWaiting = false;
  var m = customFind(_customActive);
  var d = editDraft();
  if (!m || !d || d.customKey !== m.key) return;
  editNote('drafting ' + m.name + '…');
  _resizeKeep = !!(m.saved && m.saved.start); // a reopened map keeps what it had
  requestBlankRoom(m.w, m.h);
}

/**
 * The blank room for a custom map arrived (applyBlankRoom). Keeps the
 * row's size in step with a resize.
 */
function customNoteBlank(room) {
  var m = customFind(_customActive);
  var d = editDraft();
  if (!m || !d || d.customKey !== m.key || !room) return;
  if (m.w !== room.widthTiles || m.h !== room.heightTiles) {
    m.w = room.widthTiles; m.h = room.heightTiles;
    customRenderRows();
  }
  customSaveSoon();
}

/** Called before any room is put on screen: keep the custom draft being left. */
function customStash() {
  var m = customFind(_customActive);
  var d = editDraft();
  if (m && d && d.customKey === m.key) {
    m.saved = customSerialize(d);
    customSave();
  }
  _customActive = null;
}

// ── persistence ──────────────────────────────────────────────────────────────

/**
 * The draft's *data*, not its session: no undo stack, tool or brush. Undo
 * history does not survive a reload in any editor worth copying, and a
 * serialised stack would be most of the payload.
 */
var CUSTOM_DRAFT_FIELDS = ['cells', 'added', 'specialCells', 'addedGraphics', 'placed',
  'families', 'autoFamilies', 'start', 'placedSeq', 'constructs'];

function customSerialize(d) {
  var out = {};
  CUSTOM_DRAFT_FIELDS.forEach(function (f) {
    if (d[f] !== undefined && d[f] !== null) out[f] = JSON.parse(JSON.stringify(d[f]));
  });
  return out;
}

function customRestore(d, saved) {
  CUSTOM_DRAFT_FIELDS.forEach(function (f) {
    if (saved[f] !== undefined) d[f] = JSON.parse(JSON.stringify(saved[f]));
  });
}

function customSave() {
  if (typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'saveUiPref', key: CUSTOM_MAPS_PREF, value: _customMaps.map(function (m) {
    return { key: m.key, name: m.name, borrow: m.borrow, w: m.w, h: m.h, saved: m.saved };
  }) });
}

/**
 * Save the map on screen a moment after the last edit — renderEditChrome
 * runs after every stroke, and one host write per stroke is needless.
 */
function customSaveSoon() {
  if (!_customActive) return;
  if (_customSaveTimer) clearTimeout(_customSaveTimer);
  _customSaveTimer = setTimeout(function () {
    _customSaveTimer = null;
    var m = customFind(_customActive);
    var d = editDraft();
    if (m && d && d.customKey === m.key) { m.saved = customSerialize(d); customSave(); }
  }, 600);
}

/** The host's remembered list arrived (bootstrap.js, `uiPrefs`). */
function customLoadPrefs(prefs) {
  var list = prefs && prefs[CUSTOM_MAPS_PREF];
  if (!Array.isArray(list)) return;
  var loaded = list.filter(function (m) { return m && m.key; }).map(function (m) {
    return { key: m.key, name: m.name || 'New map', borrow: Number(m.borrow) || CUSTOM_MAP_BORROW,
      w: Number(m.w) || CUSTOM_MAP_W, h: Number(m.h) || CUSTOM_MAP_H, saved: m.saved || null };
  });
  // Merge, never replace. The host posts `uiPrefs` right after `newMap`
  // when the panel is (re)built, so a map made a moment ago is not in the
  // saved list yet. Replacing dropped it: the map on screen had no row,
  // newMapPaletteReady could not find it, and the blank room — and with it
  // the Boy's start — never came.
  var known = {};
  loaded.forEach(function (m) { known[m.key] = true; });
  _customMaps.forEach(function (m) {
    if (known[m.key]) return;
    // Named before the saved list was in hand, so "New map 1" may be taken.
    if (loaded.some(function (o) { return o.name === m.name; })) {
      m.name = customNextName(loaded);
      if (m.key === _customActive) {
        var head = document.querySelector('#room-detail .rd-name');
        if (head) head.textContent = m.name;
      }
    }
    loaded.push(m);
  });
  _customMaps = loaded;
  customRenderRows();
  if (_customActive && customFind(_customActive)) customSave();
}
