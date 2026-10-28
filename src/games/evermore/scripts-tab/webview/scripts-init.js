// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's wiring — one delegated click listener on the
// pane, the filter, the host messages, and the first request when the tab is
// opened. Loaded last: every render function it calls is defined by then.
// Bound once per page (the panel rebuilds the page on every re-render).

function scrClosest(el, attr, root) {
  for (var n = el; n && n !== root; n = n.parentNode) if (n.dataset && n.dataset[attr] !== undefined) return n;
  return null;
}

function scrPick(value) {
  var i = value.indexOf(':'), kind = value.slice(0, i), v = Number(value.slice(i + 1));
  if (kind === 'room') scrSelectRoom(v);
  else if (kind === 'map') scrSelectMap(v);
  else if (kind === 'record') { _scr.record = v; _scr.player.playing = true; }
  else if (kind === 'track') scrSelectTrack(v);
  scrRender();
}

function scrOnClick(e, pane) {
  var t;
  if ((t = scrClosest(e.target, 'scrView', pane))) { _scr.view = t.dataset.scrView; scrStopPlayer(); scrStopMusic(); scrRender(); return; }
  if ((t = scrClosest(e.target, 'scrPick', pane))) { scrPick(t.dataset.scrPick); return; }
  if ((t = scrClosest(e.target, 'scrScript', pane))) { _scr.script = t.dataset.scrScript; scrAskSim(); scrRenderMain(); return; }
  if ((t = scrClosest(e.target, 'scrVariant', pane))) { _scr.variantPick[_scr.room] = Number(t.dataset.scrVariant); scrRenderMain(); return; }
  if ((t = scrClosest(e.target, 'scrFold', pane))) { scrToggleFold(Number(t.dataset.scrFold)); return; }
  if ((t = scrClosest(e.target, 'goto', pane))) { scrGoto(t); return; }
  if ((t = scrClosest(e.target, 'scrFacing', pane))) { _scr.facing = Number(t.dataset.scrFacing); _scr.player.key = ''; scrRender(); return; }
  if ((t = scrClosest(e.target, 'scrMsel', pane))) { scrSelectMapPart(t.dataset.scrMsel); return; }
  if ((t = scrClosest(e.target, 'scrMall', pane))) { _scr.mapAll[t.dataset.scrMall] = true; scrRenderMain(); return; }
  if ((t = scrClosest(e.target, 'scrMpick', pane))) { var key = ScriptsMaps.mapPickKey(t, e); if (key) scrSelectMapPart(key); return; }
  if ((t = scrClosest(e.target, 'scrPlay', pane))) { _scr.player.playing = !_scr.player.playing; t.textContent = _scr.player.playing ? '❚❚' : '▶'; return; }
  if ((t = scrClosest(e.target, 'scrStep', pane))) { scrStepFrame(Number(t.dataset.scrStep)); return; }
  if ((t = scrClosest(e.target, 'scrMplay', pane))) {
    var d = _scr.tracks[_scr.track];
    if (d && d.timeline && _scr.music.t >= d.timeline.seconds) _scr.music.t = 0;
    _scr.music.playing = !_scr.music.playing; t.textContent = _scr.music.playing ? '❚❚' : '▶'; return;
  }
  if ((t = scrClosest(e.target, 'scrMrestart', pane))) { _scr.music.t = 0; scrDrawMusic(); return; }
  if (e.target && e.target.id === 'scr-overview') { scrSeekMusic(e.target, e); return; }
}

function scrOnChange(e) {
  var t = e.target;
  if (!t || !t.dataset || t.dataset.scrToggle === undefined) return;
  _scr[t.dataset.scrToggle] = !!t.checked;
  scrAskSim();
  scrRenderMain();
}

function setupScriptsTab() {
  var pane = document.querySelector('.scr-pane');
  // A node-only harness (tests/memory/ui.test.js) runs this bundle without a browser.
  if (!pane || !pane.dataset || pane.dataset.scrBound || typeof window === 'undefined' || !window.addEventListener) return;
  pane.dataset.scrBound = '1';
  pane.addEventListener('click', function (e) { scrOnClick(e, pane); });
  pane.addEventListener('change', scrOnChange);
  // Maps: hovering an item, a byte, a box or a picture lights everything with the same key.
  pane.addEventListener('mouseover', function (e) { if (_scr.view === 'map') ScriptsMaps.mapHover(e.target, pane); });
  pane.addEventListener('mouseleave', function () { ScriptsMaps.mapHover(null, pane); });
  document.getElementById('scr-search').addEventListener('input', function (e) {
    _scr.query = e.target.value.trim();
    var rail = document.getElementById('scr-rail');
    if (rail && _scr.index) rail.innerHTML = scrRailHtml();
  });
  var tab = document.querySelector('.tab[data-tab="scripts"]');
  if (tab) tab.addEventListener('click', function () { if (!_scr.index && !_scr.requested) scrRequestIndex(); else scrRenderMain(); });
  window.addEventListener('message', function (ev) {
    var msg = ev.data || {};
    if (msg.command === 'scriptsIndex') {
      if (msg.error) { _scr.error = msg.error; _scr.requested = false; }
      else _scr.index = { rooms: msg.rooms, animations: msg.animations, music: msg.music };
      scrRender();
    } else if (msg.command === 'scriptsRoom' || msg.command === 'scriptsSim' || msg.command === 'scriptsVariants') scrOnRoomMessage(msg);
    else if (msg.command === 'scriptsMap' || msg.command === 'scriptsMapView') scrOnMapMessage(msg);
    else if (msg.command === 'scriptsAnim') scrOnAnimMessage(msg);
    else if (msg.command === 'scriptsMusic') scrOnMusicMessage(msg);
  });
  if (typeof ACTIVE_TAB !== 'undefined' && ACTIVE_TAB === 'scripts') scrRequestIndex();
}

setupScriptsTab();
