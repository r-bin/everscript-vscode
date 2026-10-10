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
  history: [],                     // timeline samples: { time, voices: [{ keyed, envx, pitch, st, start, inst, sfx }] }
  hoverSfxId: -1,
  activeSfxTriggered: {},          // sfxId -> { untilTime, voices: [] }
  freeAramBytes: 0,
};

var MU_COLORS = ['#e5c07b', '#61afef', '#98c379', '#c678dd', '#e06c75', '#56b6c2', '#d19a66', '#a9b2c3'];
var MU_OWNER_COLORS = { zp: '#5c6370', driver: '#7f8fd6', tables: '#b48ead', base: '#4f9d8f', song: '#d98a6c', data: '#e5c07b', echo: '#4d6a8f', ipl: '#5c6370' };


function muHex(n, w) { return '$' + n.toString(16).toUpperCase().padStart(w, '0'); }
function muEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function muInstColor(index) { return index < 0 ? 'transparent' : 'hsl(' + ((index * 47) % 360) + ',62%,62%)'; }
function muIsTrack() { return _music.source !== 'emu'; }

/** What the panel shows now: { view, starts, pkg, ram } or null. */
function muCurrent() {
  if (muIsTrack()) {
    if (!_music.spc) return null;
    var ram = _music.spc.ram(), view = _music.spc.view(), dir = view[32 + 0x5D] * 256, starts = [];
    for (var v = 0; v < 8; v++) { var e = (dir + view[32 + v * 16 + 4] * 4) & 0xFFFF; starts.push(ram[e] | ram[e + 1] << 8); }
    return { view: view, starts: starts, pkg: _music.model.music[Number(_music.source)].package, ram: ram };
  }
  if (!_music.live) return null;
  return { view: _music.live.view, starts: _music.live.starts, pkg: _music.live.pkg, ram: _music.ram };
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

function muRenderTimelineChannels() {
  var box = document.getElementById('mu-tl-channels');
  if (!box) return;
  if (!box.firstChild) {
    var html = '';
    for (var v = 0; v < 8; v++) {
      var badge = v >= 6 ? '<span class="mu-ch-badge mu-badge-sfx" title="Primary Sound Effects Voice">SFX</span>'
        : (v >= 4 ? '<span class="mu-ch-badge mu-badge-shared" title="Music & Shared SFX">MIX</span>'
        : '<span class="mu-ch-badge mu-badge-music" title="Music Voice">MUS</span>');
      html += '<div class="mu-tl-ch" id="mu-tl-ch-' + v + '" data-tl-v="' + v + '">' +
        '<span class="mu-ch-title">V' + v + '</span>' +
        badge +
        '<div class="mu-ch-btns">' +
        '<button class="mu-mute-btn" data-tl-mute="' + v + '" title="Mute voice V' + v + '">M</button>' +
        '<button class="mu-solo-btn" data-tl-solo="' + v + '" title="Solo voice V' + v + '">S</button>' +
        '</div>' +
        '</div>';
    }
    box.innerHTML = html;
  }
  for (var i = 0; i < 8; i++) {
    var ch = document.getElementById('mu-tl-ch-' + i);
    if (ch) {
      var mBtn = ch.querySelector('[data-tl-mute]'), sBtn = ch.querySelector('[data-tl-solo]');
      if (mBtn) mBtn.classList.toggle('mu-btn-active', !!_music.muted[i]);
      if (sBtn) sBtn.classList.toggle('mu-btn-active', !!_music.soloed[i]);
      var isHigh = false;
      if (_music.hoverSfxId >= 0) {
        var vList = muSfxVoices(_music.hoverSfxId);
        if (vList.indexOf(i) >= 0) isHigh = true;
      }
      ch.classList.toggle('mu-ch-highlight', isHigh);
    }
  }
}

/** Record live frame into scrolling history buffer. */
function muRecordTimelineFrame(cur, insts) {
  var now = performance.now();
  var voices = cur ? muVoices(cur.view) : null;
  var snapshot = [];
  var activeSfx = _music.activeSfxTriggered || {};
  for (var v = 0; v < 8; v++) {
    var vo = voices && voices[v];
    var on = !!(vo && vo.keyed && vo.envx > 0);
    var inst = vo ? insts.filter(function (x) { return x.start === cur.starts[v]; })[0] : null;
    var st = vo ? muSemitones(vo.pitch) : 0;
    // Check if voice was stolen by an active SFX
    var stealingSfx = null;
    for (var sId in activeSfx) {
      var info = activeSfx[sId];
      if (info.untilTime > now && info.voices.indexOf(v) >= 0) {
        stealingSfx = { id: Number(sId), name: info.name };
        break;
      }
    }
    snapshot.push({
      keyed: on,
      envx: vo ? vo.envx : 0,
      pitch: vo ? vo.pitch : 0,
      st: isFinite(st) ? st : 0,
      start: cur ? cur.starts[v] : 0,
      instIndex: inst ? inst.index : -1,
      sfx: stealingSfx,
      muted: _music.muted[v] || (_music.soloed.some(function(x){return x;}) && !_music.soloed[v])
    });
  }
  _music.history.push({ time: now, voices: snapshot });
  // Keep ~6 seconds of history (at 60fps ~ 360 entries)
  var cutoff = now - 6000;
  while (_music.history.length > 0 && _music.history[0].time < cutoff) {
    _music.history.shift();
  }
}

/** Draw the multi-track timeline on canvas (FamiStudio / DAW style). */
function muDrawTimeline(cur) {
  var canvas = document.getElementById('mu-tl-canvas');
  if (!canvas || !canvas.parentElement) return;
  var rect = canvas.parentElement.getBoundingClientRect();
  if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  ctx.clearRect(0, 0, W, H);

  var laneH = H / 8;
  var now = performance.now();
  var timeWindow = 5000; // 5 seconds window
  var playheadX = W * 0.75; // playhead at 75% width

  // 1. Draw channel lane backgrounds and grid lines
  for (var v = 0; v < 8; v++) {
    var y0 = v * laneH;
    ctx.fillStyle = v % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.1)';
    if (_music.hoverSfxId >= 0 && muSfxVoices(_music.hoverSfxId).indexOf(v) >= 0) {
      ctx.fillStyle = 'rgba(55,148,255,0.08)';
    }
    ctx.fillRect(0, y0, W, laneH);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, y0 + laneH);
    ctx.lineTo(W, y0 + laneH);
    ctx.stroke();

    // Center pitch reference line in each lane
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.moveTo(0, y0 + laneH / 2);
    ctx.lineTo(W, y0 + laneH / 2);
    ctx.stroke();
  }

  // Time grid vertical ticks
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (var sec = 0; sec <= 6; sec++) {
    var gx = playheadX - (sec * 1000 / timeWindow) * playheadX;
    if (gx >= 0) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
  }

  // 2. Draw historical note bars from history
  var hist = _music.history;
  if (hist && hist.length > 1) {
    for (var v = 0; v < 8; v++) {
      var y0 = v * laneH;
      for (var i = 1; i < hist.length; i++) {
        var hPrev = hist[i - 1], hCurr = hist[i];
        var dtPrev = now - hPrev.time, dtCurr = now - hCurr.time;
        var x1 = playheadX - (dtPrev / timeWindow) * playheadX;
        var x2 = playheadX - (dtCurr / timeWindow) * playheadX;
        if (x2 < 0 && x1 < 0) continue;

        var vData = hCurr.voices[v];
        if (vData && vData.keyed && vData.envx > 0) {
          var width = Math.max(2, x2 - x1);
          // Vertical offset inside lane based on pitch semitones (-36 st to +12 st)
          var stClamped = Math.max(-36, Math.min(12, vData.st));
          var pitchNorm = (stClamped + 36) / 48; // 0..1
          var barH = Math.max(3, (laneH * 0.4) * (vData.envx / 128));
          var barY = y0 + laneH - (pitchNorm * (laneH - barH - 4)) - barH - 2;

          var color = vData.instIndex >= 0 ? muInstColor(vData.instIndex) : MU_COLORS[v % MU_COLORS.length];
          if (vData.muted) {
            ctx.fillStyle = 'rgba(100,100,100,0.3)';
            ctx.fillRect(x1, barY, width, barH);
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(x1, barY, width, barH);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x1, barY, width, 1);
          }

          // SFX voice stealing overlay
          if (vData.sfx) {
            ctx.fillStyle = 'rgba(224, 108, 117, 0.4)';
            ctx.fillRect(x1, y0 + 1, width, laneH - 2);
            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            if (i % 20 === 0) {
              ctx.fillText('⚡ ' + (vData.sfx.name || 'SFX $' + vData.sfx.id.toString(16)), x1, y0 + 10);
            }
          }
        }
      }
    }
  }

  // 3. Draw playhead
  ctx.strokeStyle = '#e5c07b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, H);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Small Playhead triangle at top
  ctx.fillStyle = '#e5c07b';
  ctx.beginPath();
  ctx.moveTo(playheadX - 5, 0);
  ctx.lineTo(playheadX + 5, 0);
  ctx.lineTo(playheadX, 8);
  ctx.fill();
}

