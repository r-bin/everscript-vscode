// Ownership: the Music tab's wiring: tab visibility (and with it the
// emulator stream), the source picker, Play, instrument and key clicks, sound
// effect triggers, host messages and the per-frame loop. Loaded last; bound
// once per page (the panel rebuilds the page on every re-render).

var _muPending = {}, _muNextId = 1;

function muPost(msg) { if (typeof vs !== 'undefined' && vs) vs.postMessage(msg); }

function muStream() { muPost({ command: 'musicStream', on: _music.visible && !muIsTrack() }); }

function muSaveSource() {
  try { var st = (vs && vs.getState && vs.getState()) || {}; st.musicSource = _music.source; vs.setState(st); } catch (e) { /* no state in tests */ }
}

/** Runs `then(records0, recordsP)` once both packages are here. */
function muWithPackages(pkg, then) {
  var need = [0, pkg].filter(function (p) { return !_music.pkgData[p]; });
  if (!need.length) { then(_music.pkgData[0], _music.pkgData[pkg]); return; }
  _music._afterPackages = function () { muWithPackages(pkg, then); };
  need.forEach(function (p) { muPost({ command: 'musicPackage', id: p }); });
}

function muStop() {
  muStopOutput();
  _music.playing = false;
  muRenderStatus();
}

/** Boots the driver in the tab's engine and plays the chosen track. */
function muPlay(then) {
  var m = _music.model.music[Number(_music.source)];
  _music.error = '';
  muWithPackages(m.package, function (base, song) {
    muEngine().then(function (mod) {
      var spc = new MusicSpc(mod);
      spc.boot(_music.model.driver, base);
      spc.playMusic(m.id, song);
      _music.spc = spc; _music.playing = true; _music.startedAt = performance.now();
      muStartOutput(spc, false);
      _music.layoutKey = '';
      if (then) then(spc);
    }).catch(function (e) { _music.error = 'The sound engine failed: ' + e.message; muRenderStatus(); });
  });
}

/** Ask the emulator for its sound chip; `fn(reply)` gets { view, ram, pkg } or { error }. */
function muSnapshot(fn) {
  var id = _muNextId++;
  _muPending[id] = fn;
  muPost({ command: 'musicSnapshot', id: id });
}

function muTriggerSfx(id) {
  muAudioCtx();
  var s = _music.model && _music.model.sfx && _music.model.sfx[id];
  var sName = s ? s.name : 'sfx ' + muHex(id, 2);
  var voices = muSfxVoices(id);
  _music.activeSfxTriggered[id] = {
    name: sName,
    voices: voices,
    untilTime: performance.now() + 1200 // mark voice stolen for 1.2 sec
  };

  if (muIsTrack()) {
    if (_music.playing && _music.spc) _music.spc.playSfx(id);
    else muPlay(function (spc) { spc.playSfx(id); });
    return;
  }
  // The emulator's chip, copied into the tab's engine: mute its music, then the effect.
  muSnapshot(function (r) {
    if (r.error) { _music.error = r.error; muRenderStatus(); return; }
    muEngine().then(function (mod) {
      var spc = new MusicSpc(mod);
      spc.loadView(Uint8Array.from(r.view), Uint8Array.from(r.ram));
      spc.setMusicVolume(0);
      spc.run(32000 * 32);   // the driver ramps the volume down over about a second
      spc.playSfx(id);
      muStartOutput(spc, true, function () { muRenderStatus(); });
    }).catch(function (e) { _music.error = 'The sound engine failed: ' + e.message; muRenderStatus(); });
  });
}

function muPlayKey(semis) {
  var cur = muCurrent(), insts = muInstrumentsNow(cur);
  var inst = insts.filter(function (x) { return x.index === _music.selInst; })[0];
  if (inst && cur.ram) muPreview(cur.ram, inst, semis);
}

function muOnMessage(msg) {
  if (msg.command === 'musicModel') {
    _music.model = msg.model; _music.layoutKey = '';
    if (msg.model && msg.model.error) _music.source = 'emu';
    else if (muIsTrack() && !msg.model.music[Number(_music.source)]) _music.source = 'emu';
    muRenderSources(); muRenderStatus(); muStream();
  } else if (msg.command === 'musicEmulator') {
    _music.emuOpen = !!msg.open; muRenderStatus();
  } else if (msg.command === 'musicFrame') {
    _music.live = { view: Uint8Array.from(msg.view), pkg: msg.pkg, starts: msg.starts || [], at: performance.now() };
    _music.emuOpen = true;
    if (msg.pkg !== _music.ramPkg && !_music.snapAsked) {
      _music.snapAsked = true;
      muSnapshot(function (r) {
        _music.snapAsked = false;
        if (r.error) return;
        _music.ram = Uint8Array.from(r.ram); _music.ramPkg = r.pkg; _music.layoutKey = '';
      });
    }
  } else if (msg.command === 'musicPackageData') {
    _music.pkgData[msg.id] = msg.records.map(function (r) { return { dest: r.dest, bytes: Uint8Array.from(r.bytes) }; });
    var after = _music._afterPackages; _music._afterPackages = null;
    if (after) after();
  } else if (msg.command === 'musicSnapshotData') {
    var fn = _muPending[msg.id]; delete _muPending[msg.id];
    if (fn) fn(msg);
  }
}

/** The per-frame loop, while the tab is visible. */
function muFrame() {
  if (!_music.visible) return;
  var cur = muCurrent(), insts = muInstrumentsNow(cur);
  var echo = cur ? muEcho(cur.view).join('-') : '';
  var key = _music.source + '|' + (cur ? cur.pkg : '-') + '|' + (cur && cur.ram ? 'ram' : '') + '|' + echo + '|' + _music.selInst + '|' + _music.ramPkg;
  if (key !== _music.layoutKey) {
    _music.layoutKey = key;
    muRenderInstruments(cur, insts); muRenderSfx(cur); muRenderAram(cur);
  } else if (cur) {
    var playing = {};
    muVoices(cur.view).forEach(function (v, i) { if (v.keyed && v.envx) playing[cur.starts[i]] = true; });
    document.querySelectorAll('#mu-inst .mu-row').forEach(function (row) {
      var x = insts.filter(function (i) { return i.index === Number(row.dataset.muInst); })[0];
      row.classList.toggle('mu-playing', !!(x && playing[x.start]));
    });
  }

  // Record timeline history & render canvas
  muRecordTimelineFrame(cur, insts);
  if (_music.viewMode === 'timeline') {
    muRenderTimelineChannels();
    muDrawTimeline(cur);
  } else {
    muRenderVoices(cur, insts);
  }

  muRenderMarkers(cur, insts);
  muRenderStatus();
  requestAnimationFrame(muFrame);
}

function muShow(visible) {
  var was = _music.visible;
  _music.visible = visible;
  if (visible && !_music.model && !_music.asked) { _music.asked = true; muPost({ command: 'musicInit' }); }
  muStream();
  if (visible && !was) requestAnimationFrame(muFrame);
}

function muToggleView() {
  _music.viewMode = _music.viewMode === 'timeline' ? 'inspector' : 'timeline';
  var main = document.getElementById('mu-main');
  var btn = document.getElementById('mu-view-toggle');
  if (main) {
    main.classList.toggle('mu-view-timeline', _music.viewMode === 'timeline');
    main.classList.toggle('mu-view-inspector', _music.viewMode === 'inspector');
  }
  if (btn) {
    btn.textContent = _music.viewMode === 'timeline' ? '☷ Timeline View' : '🗂 Inspector View';
    btn.title = _music.viewMode === 'timeline' ? 'Currently in Timeline view. Click for Inspector' : 'Currently in Inspector view. Click for Timeline';
  }
}

function muOnClick(e, pane) {
  var t = e.target.closest ? e.target.closest('[data-mu-inst],[data-mu-key],[data-mu-sfx],[data-tl-mute],[data-tl-solo]') : null;
  if (!t || !pane.contains(t)) return;
  if (t.dataset.muInst !== undefined) { _music.selInst = Number(t.dataset.muInst); muPlayKey(0); _music.layoutKey = ''; return; }
  if (t.dataset.muKey !== undefined) { muPlayKey(Number(t.dataset.muKey)); return; }
  if (t.dataset.muSfx !== undefined && !t.disabled) { muTriggerSfx(Number(t.dataset.muSfx)); return; }

  // Channel mute toggle
  if (t.dataset.tlMute !== undefined) {
    var vm = Number(t.dataset.tlMute);
    _music.muted[vm] = !_music.muted[vm];
    muRenderTimelineChannels();
    return;
  }
  // Channel solo toggle
  if (t.dataset.tlSolo !== undefined) {
    var vs = Number(t.dataset.tlSolo);
    _music.soloed[vs] = !_music.soloed[vs];
    muRenderTimelineChannels();
    return;
  }
}

function muOnMouseOver(e) {
  var t = e.target.closest ? e.target.closest('[data-mu-sfx]') : null;
  var slot = document.getElementById('mu-ghost-slot');
  if (t && t.dataset.muSfx !== undefined) {
    var sId = Number(t.dataset.muSfx);
    _music.hoverSfxId = sId;
    muRenderTimelineChannels();

    var bytes = Number(t.dataset.sfxBytes) || 0;
    if (slot && bytes > 0) {
      var isOverflow = bytes > (_music.freeAramBytes || 0);
      var widthPct = Math.min(100, (bytes / 65536) * 100);
      slot.innerHTML = '<i class="mu-ghost-alloc' + (isOverflow ? ' mu-ghost-overflow' : '') + '" style="right:0;width:' + widthPct.toFixed(2) + '%" title="Needs ' + bytes + ' B (' + (bytes/1024).toFixed(1) + ' KB) in ARAM"></i>';
    }
  } else if (_music.hoverSfxId >= 0) {
    _music.hoverSfxId = -1;
    muRenderTimelineChannels();
    if (slot) slot.innerHTML = '';
  }
}

function setupMusicTab() {
  var pane = document.querySelector('.mu-pane');
  if (!pane || !pane.dataset || pane.dataset.muBound || typeof window === 'undefined' || !window.addEventListener) return;
  pane.dataset.muBound = '1';
  try { var st = vs && vs.getState && vs.getState(); if (st && st.musicSource) _music.source = st.musicSource; } catch (e) { /* tests */ }
  muRenderKeys();

  // Initial view mode setup
  var main = document.getElementById('mu-main');
  if (main) {
    main.classList.toggle('mu-view-timeline', _music.viewMode === 'timeline');
    main.classList.toggle('mu-view-inspector', _music.viewMode === 'inspector');
  }

  pane.addEventListener('click', function (e) { muOnClick(e, pane); });
  pane.addEventListener('mouseover', function (e) { muOnMouseOver(e); });
  pane.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget || !pane.contains(e.relatedTarget)) {
      _music.hoverSfxId = -1;
      muRenderTimelineChannels();
      var slot = document.getElementById('mu-ghost-slot');
      if (slot) slot.innerHTML = '';
    }
  });

  pane.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.muInst !== undefined) muOnClick(e, pane);
  });
  document.getElementById('mu-source').addEventListener('change', function (e) {
    muStop();
    _music.source = e.target.value; _music.spc = null; _music.error = ''; _music.layoutKey = '';
    _music.history = [];
    muSaveSource(); muStream(); muRenderStatus();
  });
  document.getElementById('mu-play').addEventListener('click', function () {
    muAudioCtx();
    if (_music.playing) muStop(); else muPlay();
  });
  var toggleBtn = document.getElementById('mu-view-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', muToggleView);

  window.addEventListener('keydown', function (e) {
    if (!_music.visible || e.repeat || e.metaKey || e.ctrlKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    var k = MU_KEYS.indexOf(e.key.toUpperCase());
    if (k >= 0) muPlayKey(k);
  });
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { muShow(b.dataset.tab === 'music'); });
  });
  window.addEventListener('message', function (ev) { var msg = ev.data || {}; if (typeof msg.command === 'string' && msg.command.indexOf('music') === 0) muOnMessage(msg); });
  if (typeof ACTIVE_TAB !== 'undefined' && ACTIVE_TAB === 'music') muShow(true);
}

setupMusicTab();

