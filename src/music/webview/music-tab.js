// Ownership: the Music tab's state (_music) and its drawing. The sound chip it
// shows is either the emulator's (frames from the host, ARAM from snapshots) or
// the tab's own engine playing a chosen track (music-engine.js).
// music-init.js wires events and messages and runs last.

var _music = {
  model: null, asked: false, error: '',
  source: 'emu',        // 'emu' or a music id as a string
  emuOpen: false,
  live: null,           // last emulator frame { view, pkg, starts, at }
  ram: null,            // ARAM of the emulator (Uint8Array), from the last snapshot
  ramPkg: -1,           // package that snapshot was taken with
  snapAsked: false,
  pkgData: {},          // package id -> records, for the engine
  spc: null,            // the engine while a track plays
  playing: false, startedAt: 0,
  selInst: -1,
  kon: [0, 0, 0, 0, 0, 0, 0, 0],   // time each voice was last keyed on
  keyedPrev: 0,
  visible: false,
  layoutKey: '',
  viewMode: 'timeline',            // 'timeline' or 'inspector'
  muted: [false, false, false, false, false, false, false, false],
  soloed: [false, false, false, false, false, false, false, false],
  history: [],                     // timeline frames: { time, voices } (music-timeline.js)
  runs: null,                      // per-voice effect runs while recording (music-timeline.js)
  queueAt: -1,                     // the driver's command-queue write index last seen
  frameTimes: {},                  // emulator frame -> timeline time (aligns snapshots)
  hoverSfxId: -1,
  freeAramBytes: 0,
  sfxFilter: 'all',                // 'all', 'recent', 'attack', 'loaded', 'base'
  recentSfx: {},                   // sfx id -> timeline time the game last sent it
  sfxFired: false,                 // a sound effect since the sidebar was last drawn
  timelineTime: 0,                 // emulated time of the last emulator frame (ms)
  sfxWidth: 240, sfxOpen: true,    // the sound-effects sidebar
};


var MU_COLORS = ['#e5c07b', '#61afef', '#98c379', '#c678dd', '#e06c75', '#56b6c2', '#d19a66', '#a9b2c3'];
var MU_OWNER_COLORS = { zp: '#5c6370', driver: '#7f8fd6', tables: '#b48ead', base: '#4f9d8f', song: '#d98a6c', data: '#e5c07b', echo: '#4d6a8f', ipl: '#5c6370' };


function muHex(n, w) { return '$' + n.toString(16).toUpperCase().padStart(w, '0'); }
function muEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function muInstColor(index) { return index < 0 ? 'transparent' : 'hsl(' + ((index * 47) % 360) + ',62%,62%)'; }
function muIsTrack() { return _music.source !== 'emu'; }

/** What the panel shows now: { view, starts, drv, pkg, ram } or null. */
function muCurrent() {
  if (muIsTrack()) {
    if (!_music.spc) return null;
    var ram = _music.spc.ram(), view = _music.spc.view();
    return { view: view, starts: muVoiceStarts(view, ram), drv: muDriverBytes(ram), pkg: _music.model.music[Number(_music.source)].package, ram: ram };
  }
  if (!_music.live) return null;
  return { view: _music.live.view, starts: _music.live.starts, drv: _music.live.drv, pkg: _music.live.pkg, ram: _music.ram };
}

function muPackageName(pkg) {
  var m = _music.model && _music.model.music.filter(function (x) { return x.package === pkg; })[0];
  return m ? m.name : (pkg === 0 ? 'base bank only' : 'package ' + muHex(pkg, 2));
}

function muRenderSources() {
  var sel = document.getElementById('mu-source');
  if (!sel || !_music.model || _music.model.error) return;
  sel.innerHTML = '<option value="emu">Emulator (live)</option>' + _music.model.music.map(function (m) {
    return '<option value="' + m.id + '">' + muHex(m.id, 2) + ' · ' + muEsc(m.name) + '</option>';
  }).join('');
  sel.value = _music.source;
}

function muRenderStatus() {
  var el = document.getElementById('mu-status'), btn = document.getElementById('mu-play');
  if (!el) return;
  btn.disabled = !muIsTrack() || !_music.model || !!_music.model.error;
  btn.textContent = _music.playing ? '■ Stop' : '▶ Play';
  if (_music.error || (_music.model && _music.model.error)) { el.textContent = _music.error || _music.model.error; return; }
  if (!_music.model) { el.textContent = 'Loading…'; return; }
  var cur = muCurrent();
  if (muIsTrack()) {
    var m = _music.model.music[Number(_music.source)];
    var t = _music.playing ? Math.floor((performance.now() - _music.startedAt) / 1000) : 0;
    el.innerHTML = 'Music <b>' + muHex(m.id, 2) + '</b> · package ' + muHex(m.package, 2) + (_music.playing ? ' · <b>' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') + '</b> in this tab' : ' · stopped');
    return;
  }
  if (!_music.emuOpen) { el.textContent = 'Open the emulator (Everscript: Open Emulator) to follow its sound chip.'; return; }
  if (!cur || performance.now() - _music.live.at > 1500) { el.textContent = 'Waiting for a running game in the emulator…'; return; }
  var pc = cur.view[4] | cur.view[5] << 8;
  el.innerHTML = '<b>Live</b> · package <b>' + muHex(cur.pkg, 2) + '</b> · ' + muEsc(muPackageName(cur.pkg)) + ' · driver at ' + muHex(pc, 4);
}

function muRenderVoices(cur, insts) {
  var box = document.getElementById('mu-voices');
  if (!box) return;
  if (!box.firstChild) {
    var html = '';
    for (var v = 0; v < 8; v++) {
      html += '<div class="mu-voice" data-v="' + v + '"><span class="mu-vn">V' + v + '</span><span class="mu-vs"><i class="mu-dot"></i><span></span></span>' +
        '<span class="mu-vp"></span><span class="mu-meter"><i title="Envelope (ENVX)"><b></b></i><i title="Volume left"><b></b></i><i title="Volume right"><b></b></i></span></div>';
    }
    box.innerHTML = html;
  }
  var voices = cur ? muVoices(cur.view) : null, now = performance.now(), keyed = 0;
  for (var i = 0; i < 8; i++) {
    var row = box.children[i], vo = voices && voices[i];
    var inst = vo ? insts.filter(function (x) { return x.start === cur.starts[i]; })[0] : null;
    var on = !!(vo && vo.keyed && vo.envx > 0);
    if (on) keyed |= 1 << i;
    if (on && !(_music.keyedPrev >> i & 1)) _music.kon[i] = now;
    row.classList.toggle('mu-on', on);
    row.classList.toggle('mu-kon', now - _music.kon[i] < 120);
    var color = inst ? muInstColor(inst.index) : 'var(--mu-line)';
    row.querySelector('.mu-dot').style.background = color;
    row.querySelector('.mu-vs span').textContent = vo ? (inst ? 'sample ' + muHex(inst.index, 2) : 'sample at ' + muHex(cur.starts[i], 4)) : '–';
    var st = vo ? muSemitones(vo.pitch) : -Infinity;
    row.querySelector('.mu-vp').textContent = isFinite(st) ? (st >= 0 ? '+' : '') + st.toFixed(1) + ' st' : '–';
    row.querySelector('.mu-vp').title = vo ? 'Pitch ' + muHex(vo.pitch, 4) : '';
    var bars = row.querySelectorAll('.mu-meter b');
    bars[0].style.width = (vo ? vo.envx / 1.27 : 0) + '%'; bars[0].style.background = color;
    bars[1].style.width = (vo ? Math.abs(vo.volL) / 1.27 : 0) + '%'; bars[1].style.background = color;
    bars[2].style.width = (vo ? Math.abs(vo.volR) / 1.27 : 0) + '%'; bars[2].style.background = color;
  }
  _music.keyedPrev = keyed;
  var sub = document.getElementById('mu-voices-sub');
  if (sub) sub.textContent = cur ? (function (n) { return n + ' of 8 sounding'; })(keyed.toString(2).replace(/0/g, '').length) : '';
}

/**
 * The channel column of the timeline: per voice its name, who owns it now
 * (the driver's owner byte: a music track, a sound effect, or nobody), what it
 * plays, its envelope, and mute / solo. Drawn once, then only changed text.
 */
function muRenderChannels() {
  var box = document.getElementById('mu-tl-channels');
  if (!box) return;
  if (!box.firstChild) {
    var html = '';
    for (var v = 0; v < 8; v++) {
      html += '<div class="mu-tl-ch" data-tl-v="' + v + '">' +
        '<div class="mu-ch-top"><b class="mu-ch-name">V' + v + '</b><span class="mu-ch-own"></span>' +
        '<span class="mu-ch-btns"><button class="mu-mute-btn" data-tl-mute="' + v + '" title="Mute V' + v + ' in the timeline">M</button>' +
        '<button class="mu-solo-btn" data-tl-solo="' + v + '" title="Solo V' + v + ' in the timeline">S</button></span></div>' +
        '<div class="mu-ch-what"></div>' +
        '<div class="mu-ch-vu"><i></i></div></div>';
    }
    box.innerHTML = html;
  }
  var last = _music.history[_music.history.length - 1], hover = muSfxLanes(_music.hoverSfxId);
  for (var i = 0; i < 8; i++) {
    var ch = box.children[i], V = last && last.voices[i];
    var own = '', ownCls = 'mu-own-idle', what = '', tip = 'Free: the driver gives this voice to nobody now', color = 'var(--mu-line)';
    if (V && V.own === 'sfx') {
      var info = muSfxInfo(V.sfx);
      own = MU_CAT_ICONS[info.cat] + ' SFX ' + muHex(V.sfx, 2); ownCls = 'mu-own-' + info.cat;
      what = info.name; color = MU_CAT_COLORS[info.cat];
      tip = 'Sound effect ' + muHex(V.sfx, 2) + ' · ' + info.name + (info.source ? ' · played by ' + info.source : '');
    } else if (V && V.own === 'mus') {
      own = '♪ T' + V.track; ownCls = 'mu-own-mus';
      what = V.on ? (V.inst >= 0 ? muHex(V.inst, 2) : '@' + muHex(V.start, 4)) + ' ' + (V.st >= 0 ? '+' : '') + V.st.toFixed(1) + ' st' : 'rest';
      color = V.inst >= 0 ? muInstColor(V.inst) : MU_COLORS[i];
      tip = 'Music track ' + V.track + (V.on && V.inst >= 0 ? ' · sample ' + muHex(V.inst, 2) + ' at ' + V.st.toFixed(1) + ' semitones from its own rate' : '');
    } else if (V) {
      what = V.on ? 'releasing' : 'free';
    }
    var key = own + '|' + what + '|' + _music.muted[i] + _music.soloed[i] + (hover.indexOf(i) >= 0);
    if (ch._key !== key) {
      ch._key = key;
      var o = ch.querySelector('.mu-ch-own');
      o.textContent = own || '—'; o.className = 'mu-ch-own ' + ownCls;
      ch.querySelector('.mu-ch-what').textContent = what;
      ch.title = tip;
      ch.querySelector('[data-tl-mute]').classList.toggle('mu-btn-active', !!_music.muted[i]);
      ch.querySelector('[data-tl-solo]').classList.toggle('mu-btn-active', !!_music.soloed[i]);
      ch.classList.toggle('mu-ch-highlight', hover.indexOf(i) >= 0);
      ch.classList.toggle('mu-ch-muted', muLaneMuted(i));
    }
    var bar = ch.querySelector('.mu-ch-vu i');
    bar.style.width = (V && V.on ? Math.round(V.envx / 1.27) : 0) + '%';
    bar.style.background = color;
  }
}
