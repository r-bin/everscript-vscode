// Ownership: the Secret of Mana Maps page — its data (the #init block and the som:// files the host reads on
// request: {command:'read', path} -> 'file'), the rail of areas and maps, and opening a map in the editor
// (editor.js). The page frame, rail behaviour, layout, zoom and pan are the shared editor shell's
// (src/shared/webview/map-editor-shell/), the same files the Evermore Rooms tab runs on.
// State owned here: the open map and the view prefs (persisted with vscode.setState).
(function () {
  // @ts-ignore acquireVsCodeApi is provided by the webview host
  var vscode = acquireVsCodeApi();
  var init = JSON.parse(document.getElementById('init').textContent || '{}');
  var app = document.getElementById('app');

  var state = Object.assign({ map: null, prefs: {} }, vscode.getState() || {});
  var maps = new Map((init.maps || []).map(function (m) { return [m.id, m]; }));
  var areas = init.areas || [];
  var editor = null;
  var pending = new Map();      // path -> [callbacks]
  var files = new Map();        // path -> parsed JSON

  function save() { vscode.setState(state); }
  // Layout widths and collapsed sidebars are the shell's preferences; the page remembers them itself.
  shellPrefSaver = function (key, value) { state.prefs[key] = value; save(); };

  /** Read a som://rom/ JSON file through the host, once. */
  function readJson(path, cb) {
    // Always async, so a caller can attach what it draws into before the data arrives.
    if (files.has(path)) { Promise.resolve().then(function () { cb(files.get(path)); }); return; }
    if (pending.has(path)) { pending.get(path).push(cb); return; }
    pending.set(path, [cb]);
    vscode.postMessage({ command: 'read', path: path });
  }
  window.addEventListener('message', function (ev) {
    var msg = ev.data || {};
    if (msg.command !== 'file') return;
    var data = null;
    try { data = msg.text ? JSON.parse(msg.text) : null; } catch (e) { data = null; }
    files.set(msg.path, data);
    (pending.get(msg.path) || []).forEach(function (cb) { cb(data); });
    pending.delete(msg.path);
  });

  /** A map's name in the rail: its area and its place in it, like the converted rooms in the Rooms tab. */
  function railEntries() {
    var entries = [];
    areas.forEach(function (a) {
      if (!a.maps.length) return;
      entries.push({ area: a.name, rooms: a.maps.map(function (id, i) {
        var m = maps.get(id) || { hex: String(id) };
        var name = a.maps.length > 1 ? a.name + ' ' + (i + 1) : a.name;
        return { name: name, tag: m.hex, attrs: { map: id, name: name, area: a.name } };
      }) });
    });
    return entries;
  }

  function entryFor(id) {
    var m = maps.get(id);
    var row = document.querySelector('.rn-map[data-map="' + id + '"]');
    var area = row ? row.dataset.area : '';
    var group = null;
    areas.forEach(function (a) { (a.pictures || []).forEach(function (g) { if (g.indexOf(id) >= 0 && g.length > 1) group = g; }); });
    var same = group ? 'same picture: ' + group.filter(function (x) { return x !== id; }).map(function (x) { return (maps.get(x) || { hex: x }).hex; }).join(', ') : '';
    return Object.assign({}, m, { name: row ? row.dataset.name : m.hex, areaName: area, note: [m.w + '×' + m.h, same].filter(Boolean).join(' · ') });
  }

  function select(li) {
    var id = Number(li.dataset.map);
    document.querySelectorAll('.rn-map.rsel').forEach(function (x) { x.classList.remove('rsel'); });
    li.classList.add('rsel');
    state.map = id;
    save();
    openMap(id);
  }

  var opening = null;
  function openMap(id) {
    var m = maps.get(id);
    if (!m) return;
    opening = id;
    var panel = document.getElementById('room-detail');
    if (editor) { editor.close(); editor = null; }
    panel.className = 'rm-detail-placeholder';
    panel.innerHTML = '<span>Opening ' + m.hex + '…</span>';
    readJson('maps/' + m.hex + '.edit.json', function (data) {
      if (opening !== id) return;
      if (!data) { panel.innerHTML = '<div class="rs rs-error"><div class="rs-h">Cannot open this map</div><div class="rs-note">The ROM could not decode it.</div></div>'; return; }
      editor = manaEditorOpen({ entry: entryFor(id), data: data, somBase: init.somBase, state: state, save: save, readJson: readJson });
    });
  }

  if (init.error) { app.innerHTML = '<div class="message">' + shellEscape(init.error) + '</div>'; return; }

  app.innerHTML = shellFrameHtml({
    railHtml: shellRailHtml({
      groups: [{ key: 'som', label: 'Secret of Mana', title: 'Every map of the game, grouped by area', open: true, body: shellRailTreeHtml(railEntries()) }],
      search: { placeholder: 'Search maps' }, noneText: 'No maps match',
    }),
    placeholder: 'Select a map',
  });
  shellRailBind({ onSelect: select });
  layoutApplyPrefs(Object.assign({}, state.prefs.layoutWidths, { layoutCollapsed: state.prefs.layoutCollapsed }));
  var first = state.map !== null && document.querySelector('.rn-map[data-map="' + state.map + '"]');
  if (first) { var area = first.closest('li.rn-area'); if (area) area.classList.remove('collapsed'); select(first); }
})();
