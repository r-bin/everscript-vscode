// Ownership: custom maps on the host — loading the list, saving the map on
// screen (its data and its whole history) a moment after every edit,
// reopening the map that was open when the panel was rebuilt, exporting a
// map as a .zip and deleting one.
//
// The host side is rooms/custom-host.js; the files are
// docs/map-format/custom-map-files.md. Split out of map-editor-custom.js,
// which owns the rail rows and binding a map to the draft.
//
// Owns: _customSaveTimer, _customLoaded, _customLoadWaiters.

var _customSaveTimer = null;
/** 'no' until asked, 'asking' while the host's list is on its way, 'yes' once it is in. */
var _customLoaded = 'no';
/** What waits for the list: a `New Map` that arrived first. */
var _customLoadWaiters = [];

/** How long after the last change the map is written. Short: the panel can be rebuilt at any moment. */
var CUSTOM_SAVE_DELAY = 250;

// ── loading ──────────────────────────────────────────────────────────────────

/** Ask the host for the saved maps (bootstrap.js, on `uiPrefs`). */
function customRequestMaps() {
  if (typeof vs === 'undefined' || !vs || _customLoaded !== 'no') return;
  _customLoaded = 'asking';
  vs.postMessage({ command: 'requestCustomMaps' });
  // A host that never answers must not hold `New Map` forever.
  setTimeout(function () { if (_customLoaded === 'asking') customLoadMaps({ maps: [] }); }, 2000);
}

/** Run `fn` once the list is in; true when it had to wait. */
function customWaitForMaps(fn) {
  // `> new map` reaches a freshly built panel *before* `uiPrefs` asks for
  // the list (extension.js posts `newMap` first), so not having asked yet is
  // no answer either: ask now and wait. Otherwise every such New Map made
  // another empty "New map 1" beside the untouched one it should reopen.
  if (_customLoaded === 'no') customRequestMaps();
  if (_customLoaded !== 'asking') return false;
  _customLoadWaiters.push(fn);
  return true;
}

/** The host's list arrived (`customMaps`). */
function customLoadMaps(msg) {
  var list = (msg && msg.maps) || [];
  var loaded = list.filter(function (m) { return m && m.key; }).map(function (m) {
    return { key: m.key, name: m.name || 'New map', borrow: Number(m.borrow) || CUSTOM_MAP_BORROW,
      w: Number(m.w) || CUSTOM_MAP_W, h: Number(m.h) || CUSTOM_MAP_H, saved: m.saved || null,
      history: m.history || null, created: m.created, readOnly: !!m.readOnly };
  });
  // Merge, never replace: a map made before the list arrived is not in it.
  // It is renumbered if its name is taken, and saved.
  var known = {};
  loaded.forEach(function (m) { known[m.key] = true; });
  _customMaps.forEach(function (m) {
    if (known[m.key]) return;
    if (loaded.some(function (o) { return o.name === m.name; })) {
      m.name = customNextName(loaded);
      if (m.key === _customActive) {
        var head = document.querySelector('#room-detail .rd-name');
        if (head) head.textContent = m.name;
      }
      customSave(m);
    }
    loaded.push(m);
  });
  _customMaps = loaded;
  _customLoaded = 'yes';
  customRenderRows();
  var waiters = _customLoadWaiters;
  _customLoadWaiters = [];
  waiters.forEach(function (fn) { fn(); });
  // Where you left off: the map that was open, if nothing else is.
  if (!waiters.length && !_customActive && msg && msg.active && customFind(msg.active) && customNothingOpen()) {
    customOpen(msg.active);
  }
}

/** True when the Rooms tab shows no room of its own choosing. */
function customNothingOpen() {
  var tab = document.querySelector('.tab[data-tab="rooms"]');
  if (tab && !tab.classList.contains('tab-active') && !tab.classList.contains('active')) return false;
  return !document.querySelector('.rn-map.rsel');
}

// ── saving ───────────────────────────────────────────────────────────────────

/** Write one map (the one on screen by default): its document and its history. */
function customSave(m) {
  m = m || customFind(_customActive);
  if (!m || m.readOnly || typeof vs === 'undefined' || !vs) return;
  // A widget's canvas saves into the widget, not a map folder (map-editor-widget-edit.js).
  if (m.widget) { if (typeof widgetFromSession === 'function') widgetFromSession(m); return; }
  var d = editDraft();
  if (d && d.customKey === m.key) customCapture(m, d);
  vs.postMessage({ command: 'saveCustomMap',
    map: { key: m.key, name: m.name, borrow: m.borrow, w: m.w, h: m.h, created: m.created,
      saved: m.saved || {}, history: m.history || { undo: [], redo: [] } },
    order: _customMaps.map(function (o) { return o.key; }),
    active: _customActive });
}

/**
 * Rename a custom map from its name line (detail-renderer.js `#rg-map-name`).
 * An empty name is not applied: the field shows the last one when left.
 */
function customRename(key, name) {
  var m = customFind(key);
  var n = String(name || '').trim().slice(0, 80);
  if (!m || m.widget || m.readOnly || !n || n === m.name) return;
  m.name = n;
  customRenderRows();
  customSaveSoon();
}

/**
 * The name fields on the name line — a custom map's (`#rg-map-name`) and a
 * widget's (`#rg-widget-name`, map-editor-widget-edit.js). Typing renames;
 * Enter or Escape is done typing; a map's field left empty shows the name it kept.
 * Delegated on the panel, once (bindEditControls), so it survives redraws.
 */
function bindNameFields(panel) {
  panel.addEventListener('input', function (e) {
    var id = e.target && e.target.id;
    if (id === 'rg-widget-name') widgetEditRename(e.target.value);
    else if (id === 'rg-map-name') customRename(_customActive, e.target.value);
  });
  panel.addEventListener('change', function (e) {
    var m = e.target && e.target.id === 'rg-map-name' && customFind(_customActive);
    if (m) e.target.value = m.name;
  });
  panel.addEventListener('keydown', function (e) {
    var id = e.target && e.target.id;
    if ((id === 'rg-map-name' || id === 'rg-widget-name') && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

/**
 * Save the map on screen a moment after the last edit — renderEditChrome
 * runs after every stroke, and one host write per stroke is needless.
 */
function customSaveSoon() {
  if (!_customActive) return;
  if (_customSaveTimer) clearTimeout(_customSaveTimer);
  _customSaveTimer = setTimeout(function () { _customSaveTimer = null; customSave(); }, CUSTOM_SAVE_DELAY);
}

/** Write now what is waiting to be written: the panel is going away. */
function customFlush() {
  if (!_customSaveTimer) return;
  clearTimeout(_customSaveTimer);
  _customSaveTimer = null;
  customSave();
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', customFlush);
  window.addEventListener('beforeunload', customFlush);
}

function customRememberActive(key) {
  if (typeof _widgetEdit !== 'undefined' && _widgetEdit && _widgetEdit.key === key) return; // not a map to reopen
  if (typeof vs !== 'undefined' && vs && _customLoaded === 'yes') vs.postMessage({ command: 'setCustomActive', key: key });
}

// ── untouched maps ───────────────────────────────────────────────────────────

/** Nothing was ever done to it: no history, nothing drawn, still its first size. */
function customIsPristine(m) {
  var d = editDraft();
  var live = d && d.customKey === m.key ? d : null;
  var hist = live ? live.undo : (m.history && m.history.undo) || [];
  if (hist.length) return false;
  var s = live || m.saved || {};
  var any = function (o) { return !!o && Object.keys(o).length > 0; };
  if (any(s.cells) || any(s.cut) || any(s.specialCells) || (s.groups || []).length) return false;
  return !(s.placed || []).some(function (p) { return !p.removed; });
}

/** An untouched map to reopen instead of making a new one: the open one first, then the newest. */
function customPristineMap(w, h, borrow) {
  var fits = function (m) { return m && m.w === w && m.h === h && !m.readOnly && customIsPristine(m); };
  var open = customFind(_customActive);
  if (fits(open)) return open;
  if (_customMaps.length > 0) {
    var last = _customMaps[_customMaps.length - 1];
    if (fits(last)) return last;
  }
  for (var i = _customMaps.length - 1; i >= 0; i--) if (fits(_customMaps[i])) return _customMaps[i];
  return null;
}

// ── export and delete (the ⋯ menu) ───────────────────────────────────────────

/** `Export map…`: the .zip of docs/map-format/custom-map-files.md §4. */
function customExportMap() {
  var m = customFind(_customActive);
  if (!m) { editNote('Export map works on a custom map — make one with + New Map'); renderEditChrome(); return; }
  var why = {};
  var draft = romExportPayload(why);
  if (!draft) { editNote(why.text); renderEditChrome(); return; }
  var d = editDraft();
  customCapture(m, d);
  vs.postMessage({ command: 'exportCustomMap', draft: draft, stamps: customStampsInUse(d),
    map: { key: m.key, name: m.name, borrow: m.borrow, w: m.w, h: m.h, created: m.created, saved: m.saved } });
  editNote('exporting ' + m.name + '…');
  renderEditChrome();
}

/** Every stamp the map and its cuttable layer use, with its words and counts. */
function customStampsInUse(d) {
  var by = {};
  [['cells', d.cells], ['cut', d.cut || {}]].forEach(function (pair) {
    Object.keys(pair[1]).forEach(function (k) {
      var i = pair[1][k];
      var w = editStampWords(_mtPalette, i);
      if (!w) return;
      var s = by[i] || (by[i] = { index: i, layer1: w.layer1, layer2: w.layer2, collision: w.collision, cells: 0, cut: 0 });
      s[pair[0]] += 1;
    });
  });
  return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.index - b.index; });
}

function applyCustomMapExported(msg) {
  if (!msg || msg.cancelled) { editNote('export cancelled'); }
  else if (msg.error) { editNote('export failed: ' + msg.error); }
  else { editNote('exported ' + msg.path); }
  renderEditChrome();
}

/** `Delete map…`: the host asks first (a modal), then removes the folder. */
function customDeleteMap() {
  var m = customFind(_customActive);
  if (!m) { editNote('Delete map works on a custom map'); renderEditChrome(); return; }
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'deleteCustomMap', key: m.key, name: m.name });
}

function applyCustomMapDeleted(msg) {
  if (!msg || msg.cancelled || msg.error || !msg.key) return;
  var wasOpen = _customActive === msg.key;
  if (_customSaveTimer && wasOpen) { clearTimeout(_customSaveTimer); _customSaveTimer = null; }
  _customMaps = _customMaps.filter(function (m) { return m.key !== msg.key; });
  if (wasOpen) {
    _customActive = null;
    customRenderRows();
    var next = _customMaps[_customMaps.length - 1];
    if (next) { customOpen(next.key); editNote('map deleted — showing ' + next.name); renderEditChrome(); }
    else customShowNothing();
  } else {
    customRenderRows();
  }
}

/** The detail panel with no map left to show. */
function customShowNothing() {
  var d = editDraft();
  if (d) d.on = false;
  var detail = document.getElementById('room-detail');
  if (detail) {
    detail.innerHTML = '<div class="rs-note rg-empty-detail">The map was deleted. Make a new one with '
      + '<b>+ New Map</b>, or pick a room.</div>';
  }
}
