// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's page state (_scr) and the parts every view
// shares: escaping, the host requests, the left rail and the dispatch to the
// view that draws the middle and the right side. The views live in
// scripts-room.js, scripts-anim.js, scripts-music.js and the Maps view's
// builders in scripts-maps.dom.ts (ScriptsMaps); scripts-init.js binds.

var SCR_FACINGS = [['N', 0], ['NE', 2], ['E', 4], ['SE', 6], ['S', 8], ['SW', 10], ['W', 12], ['NW', 14]];

var _scr = {
  view: 'room',          // room | map | anim | music
  index: null,           // scriptsIndex: { rooms, animations, music }
  error: '',
  requested: false,
  query: '',
  // Everscript
  room: null,            // selected room id
  rooms: {},             // id -> { room, picture }
  script: 'enter',       // selected script key in the room
  everscript: false,     // show the simulation's Everscript instead of the bytes
  clusters: false,       // group the room's triggers by the simulation's clusters
  sims: {},              // room + ':' + key -> { everscript, clusters } | 'pending'
  variants: {},          // room id -> { variants, error } | 'pending' (who stands in it per story state)
  variantPick: {},       // room id -> chosen variant index (0, the default, until picked)
  folds: {},             // room id -> { block id: folded } (the merged enter script's folds)
  structured: true,      // the enter script as if/else/while (off: each instruction as printed, gotos and all)
  // Maps
  map: null,             // selected room id
  maps: {},              // id -> { map, picture } | 'pending'
  mapSel: 'header',      // selected section or item key (model/map-views.ts)
  mapViews: {},          // id + '|' + key -> { panels } | { error } | 'pending'
  mapAll: {},            // section key -> show every byte
  // Animations
  record: null,          // selected animation record
  facing: 8,
  anims: {},             // record + ':' + facing -> anim | 'pending' | { error }
  player: { key: '', frame: 0, tick: 0, playing: true, raf: 0, last: 0 },
  // Music
  track: null,
  tracks: {},            // id -> { sequence, timeline } | 'pending' | { error }
  music: { t: 0, playing: false, raf: 0, last: 0 },
};

function scrEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function scrHex(v, d) { return Number(v).toString(16).toUpperCase().padStart(d || 2, '0'); }

function scrPost(msg) { if (vs) vs.postMessage(msg); }

function scrRequestIndex() { _scr.requested = true; scrPost({ command: 'scriptsInit' }); }

function scrMatches(text) {
  var q = _scr.query.toLowerCase();
  return !q || String(text).toLowerCase().indexOf(q) >= 0;
}

/** One rail row: data-scr-pick="<kind>:<value>". */
function scrRailRow(kind, value, on, main, sub, extra) {
  return '<div class="scr-item' + (on ? ' scr-sel' : '') + '" data-scr-pick="' + kind + ':' + value + '">' +
    '<span class="scr-item-main">' + main + '</span>' +
    (sub ? '<span class="scr-item-sub">' + sub + '</span>' : '') + (extra || '') + '</div>';
}

function scrRailHtml() {
  var ix = _scr.index, out = [];
  if (_scr.view === 'room' || _scr.view === 'map') {
    var area = null, kind = _scr.view === 'map' ? 'map' : 'room', sel = _scr.view === 'map' ? _scr.map : _scr.room;
    ix.rooms.slice().sort(function (a, b) { return (a.area || '~').localeCompare(b.area || '~') || a.id - b.id; }).forEach(function (r) {
      if (!scrMatches(r.idHex + ' ' + r.name + ' ' + r.area)) return;
      if (r.area !== area) { area = r.area; out.push('<div class="scr-group">' + scrEsc(area || 'Other') + '</div>'); }
      out.push(scrRailRow(kind, r.id, r.id === sel, '<code>$' + r.idHex + '</code> ' + scrEsc(r.name)));
    });
  } else if (_scr.view === 'anim') {
    ix.animations.forEach(function (a) {
      if (!scrMatches(a.recHex + ' ' + a.label + ' ' + a.scriptHex)) return;
      out.push(scrRailRow('record', a.record, a.record === _scr.record, '<code>' + a.recHex + '</code> ' + scrEsc(a.label),
        a.facings > 1 ? a.facings + ' facings' : '', a.effect ? '<span class="scr-badge" title="Signals effect_done: an alchemy effect">⚗</span>' : ''));
    });
  } else if (_scr.view === 'music') {
    ix.music.forEach(function (m) {
      if (!scrMatches(scrHex(m.id) + ' ' + m.name)) return;
      out.push(scrRailRow('track', m.id, m.id === _scr.track, '<code>$' + scrHex(m.id) + '</code> ' + scrEsc(m.name), 'package $' + scrHex(m.package)));
    });
  }
  return out.join('') || '<div class="scr-empty">Nothing matches.</div>';
}

function scrToolsHtml() {
  if (_scr.view === 'room') {
    return '<label class="scr-check" title="Show the simulation\'s Everscript for the script (compiles back to the same bytes). The simulation is work in progress.">' +
      '<input type="checkbox" data-scr-toggle="everscript"' + (_scr.everscript ? ' checked' : '') + '> Everscript (simulation)</label>' +
      '<label class="scr-check" title="Group the triggers by the simulation\'s clusters: pickups, exits, dialog, cutscenes">' +
      '<input type="checkbox" data-scr-toggle="clusters"' + (_scr.clusters ? ' checked' : '') + '> Clusters</label>' +
      '<label class="scr-check" title="Read the enter script as if / else / while. Off: each instruction as it is in the ROM, with its gotos">' +
      '<input type="checkbox" data-scr-toggle="structured"' + (_scr.structured ? ' checked' : '') + '> Structured</label>';
  }
  if (_scr.view === 'anim') {
    return '<span class="scr-seg" role="group" title="Facing">' + SCR_FACINGS.map(function (f) {
      return '<button class="scr-seg-btn' + (f[1] === _scr.facing ? ' scr-on' : '') + '" data-scr-facing="' + f[1] + '">' + f[0] + '</button>';
    }).join('') + '</span>';
  }
  return '';
}

function scrRender() {
  document.querySelectorAll('[data-scr-view]').forEach(function (b) { b.classList.toggle('scr-on', b.dataset.scrView === _scr.view); });
  var rail = document.getElementById('scr-rail'), mid = document.getElementById('scr-mid'), side = document.getElementById('scr-side');
  var tools = document.getElementById('scr-tools');
  if (!rail) return;
  if (!_scr.index) {
    rail.innerHTML = '<div class="scr-empty">' + scrEsc(_scr.error || 'Loading…') + '</div>';
    mid.innerHTML = ''; side.innerHTML = ''; tools.innerHTML = '';
    return;
  }
  tools.innerHTML = scrToolsHtml();
  rail.innerHTML = scrRailHtml();
  scrRenderMain();
}

/** Re-draws the middle and the right side only (keeps the rail's scroll). */
function scrRenderMain() {
  var mid = document.getElementById('scr-mid'), side = document.getElementById('scr-side');
  if (!mid || !_scr.index) return;
  ScriptsMaps.stopFrames();
  if (_scr.view === 'room') scrRenderRoom(mid, side);
  else if (_scr.view === 'map') scrRenderMap(mid, side);
  else if (_scr.view === 'anim') scrRenderAnim(mid, side);
  else scrRenderMusic(mid, side);
}

// ── Maps (the builders are ScriptsMaps, scripts-maps.dom.ts) ─────────────────
function scrSelectMap(id) {
  _scr.map = id; _scr.mapSel = 'header'; _scr.mapAll = {};
  if (!_scr.maps[id]) { _scr.maps[id] = 'pending'; scrPost({ command: 'scriptsMap', id: id }); }
}

function scrSelectMapPart(key) {
  _scr.mapSel = key;
  var k = _scr.map + '|' + key;
  if (!_scr.mapViews[k]) { _scr.mapViews[k] = 'pending'; scrPost({ command: 'scriptsMapView', id: _scr.map, key: key }); }
  scrRenderMain();
}

function scrRenderMap(mid, side) {
  if (_scr.map == null) { mid.innerHTML = '<div class="scr-empty">Pick a map on the left.</div>'; side.innerHTML = ''; return; }
  var d = _scr.maps[_scr.map];
  mid.innerHTML = ScriptsMaps.mapMidHtml(d && d !== 'pending' ? d.map : d, _scr.mapSel, _scr.mapAll);
  if (!d || d === 'pending' || d.map.error) { side.innerHTML = ''; return; }
  var k = _scr.map + '|' + _scr.mapSel;
  if (!_scr.mapViews[k]) { _scr.mapViews[k] = 'pending'; scrPost({ command: 'scriptsMapView', id: _scr.map, key: _scr.mapSel }); }
  side.innerHTML = ScriptsMaps.mapSideHtml(_scr.mapViews[k], d.picture && d.picture.uri ? d.picture : null);
  ScriptsMaps.startFrames(side);
}

function scrOnMapMessage(msg) {
  if (msg.command === 'scriptsMap') _scr.maps[msg.id] = { map: msg.error ? { error: msg.error } : msg.map, picture: msg.picture };
  else _scr.mapViews[msg.id + '|' + msg.key] = msg.error ? { error: msg.error } : { panels: msg.panels };
  if (_scr.view === 'map' && msg.id === _scr.map) scrRenderMain();
}
