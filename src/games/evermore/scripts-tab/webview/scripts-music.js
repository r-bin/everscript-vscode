// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's Music view — a track's sequence as its package
// uploads it (pointer, header, one byte run per track; the opcodes are not
// decoded yet, bytes >= $F0 are marked as commands), and a silent player on
// the right: the notes the host's engine played (music/model/track-timeline.js,
// injected), as 8 voice lanes moving under a playhead. No audio.

var SCR_MUSIC_SECONDS = 60;
var SCR_WINDOW = 8;         // seconds visible in the lanes
var SCR_HEAD = 0.3;         // playhead position across the lanes
var SCR_VOICE_COLORS = ['#4fc1ff', '#c586c0', '#4ec9b0', '#dcdcaa', '#ce9178', '#b5cea8', '#d16969', '#9cdcfe'];

function scrSelectTrack(id) {
  _scr.track = id;
  _scr.music.t = 0; _scr.music.playing = false;
  if (!_scr.tracks[id]) { _scr.tracks[id] = 'pending'; scrPost({ command: 'scriptsMusic', id: id, seconds: SCR_MUSIC_SECONDS }); }
}

function scrSeqBytesHtml(bytes) {
  return bytes.map(function (b) {
    return '<span class="' + (b >= 0xF0 ? 'scr-cmd' : 'scr-nb') + '">' + scrHex(b) + '</span>';
  }).join(' ');
}

function scrSequenceHtml(seq) {
  if (!seq) return '<div class="scr-note scr-warn">This package carries no sequence pointer.</div>';
  return '<div class="scr-sub">Pointer at <code>$' + scrHex(seq.pointerAt, 4) + '</code> → sequence at <code>$' + scrHex(seq.start, 4) + '</code> (ARAM) · ' +
    seq.tracks.length + ' tracks · header <code>' + seq.header.map(function (b) { return scrHex(b); }).join(' ') + '</code><br>' +
    'The opcode table is not decoded yet: <span class="scr-cmd">F0+</span> bytes are commands (some take operands), the rest notes and durations.</div>' +
    seq.tracks.map(function (t) {
      return '<div class="scr-track"><div class="scr-track-h" style="border-color:' + SCR_VOICE_COLORS[t.index % 8] + '">Track ' + t.index +
        ' <code>$' + scrHex(t.aram, 4) + '</code> <span class="scr-dim">' + t.bytes.length + ' bytes</span></div>' +
        '<div class="scr-seq">' + scrSeqBytesHtml(t.bytes) + '</div></div>';
    }).join('');
}

function scrRenderMusic(mid, side) {
  scrStopMusic();
  var m = _scr.index.music[_scr.track];
  if (!m) { mid.innerHTML = '<div class="scr-empty">Pick a track on the left.</div>'; side.innerHTML = ''; return; }
  var d = _scr.tracks[_scr.track];
  mid.innerHTML = '<div class="scr-h">' + scrEsc(m.name) + ' <span class="scr-dim">music $' + scrHex(m.id) + ' · package $' + scrHex(m.package) + '</span></div>' +
    (!d || d === 'pending' ? '<div class="scr-note">Reading the package…</div>' : scrSequenceHtml(d.sequence));
  if (!d || d === 'pending') { side.innerHTML = '<div class="scr-empty">Playing the track silently in the sound engine…</div>'; return; }
  if (d.error || !d.timeline || d.timeline.error) { side.innerHTML = '<div class="scr-empty scr-warn">' + scrEsc(d.error || (d.timeline && d.timeline.error) || 'No timeline') + '</div>'; return; }
  side.innerHTML = '<div class="scr-side-h">Player <span class="scr-dim">no sound · ' + d.timeline.notes.length + ' notes in the first ' + d.timeline.seconds + ' s</span></div>' +
    '<canvas id="scr-lanes" class="scr-lanes" height="248"></canvas>' +
    '<canvas id="scr-overview" class="scr-overview" height="28" title="Click to jump"></canvas>' +
    '<div class="scr-ctl"><button class="scr-btn" data-scr-mplay>' + (_scr.music.playing ? '❚❚' : '▶') + '</button>' +
    '<button class="scr-btn" data-scr-mrestart title="Back to the start">⏮</button><span class="scr-dim" id="scr-mtime"></span></div>' +
    '<div class="scr-voices" id="scr-voices"></div>' +
    '<div class="scr-note">Notes are read off the chip once per frame: a note starts where a voice\'s envelope rises or its pitch moves by half a semitone or more.</div>';
  scrDrawMusic();
  scrStartMusic();
}

function scrDrawMusic() {
  var d = _scr.tracks[_scr.track], tl = d && d.timeline;
  var cv = document.getElementById('scr-lanes'), ov = document.getElementById('scr-overview');
  if (!tl || !cv || !cv.getContext) return;
  var w = cv.clientWidth || 400;
  if (cv.width !== w) cv.width = w;
  if (ov.width !== w) ov.width = w;
  var g = cv.getContext('2d'), H = cv.height, lane = H / 8, t = _scr.music.t, f = t * 60;
  var left = f - SCR_WINDOW * 60 * SCR_HEAD, pxPerFrame = w / (SCR_WINDOW * 60);
  g.clearRect(0, 0, w, H);
  for (var v = 0; v < 8; v++) {
    g.fillStyle = v % 2 ? 'rgba(128,128,128,0.06)' : 'rgba(128,128,128,0.12)';
    g.fillRect(0, v * lane, w, lane);
  }
  var now = [];
  tl.notes.forEach(function (n) {
    if (n.f1 < left || n.f0 > left + SCR_WINDOW * 60) return;
    var x = (n.f0 - left) * pxPerFrame, x1 = (n.f1 - left) * pxPerFrame;
    var semi = n.semi == null ? 0 : Math.max(-48, Math.min(24, n.semi));
    var y = n.v * lane + 2 + (1 - (semi + 48) / 72) * (lane - 8);
    var on = n.f0 <= f && f < n.f1;
    if (on) now[n.v] = n;
    g.globalAlpha = n.f0 > f ? 0.45 : 1;
    g.fillStyle = SCR_VOICE_COLORS[n.v];
    g.fillRect(x, y, Math.max(2, x1 - x - 1), 4);
    if (on) { g.strokeStyle = SCR_VOICE_COLORS[n.v]; g.strokeRect(x - 1, y - 1, Math.max(2, x1 - x - 1) + 2, 6); }
  });
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.fillRect(Math.round(w * SCR_HEAD), 0, 1, H);
  scrDrawOverview(ov, tl, f);
  var tm = document.getElementById('scr-mtime');
  if (tm) tm.textContent = t.toFixed(1) + ' s / ' + tl.seconds + ' s';
  var vo = document.getElementById('scr-voices');
  if (vo) vo.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(function (v) {
    var n = now[v];
    return '<div class="scr-voice"><i style="background:' + SCR_VOICE_COLORS[v] + '"></i>V' + v + ' ' +
      (n ? 'sample ' + n.srcn + ' · ' + (n.semi > 0 ? '+' : '') + n.semi + ' st' : '<span class="scr-dim">—</span>') + '</div>';
  }).join('');
}

function scrDrawOverview(ov, tl, f) {
  var g = ov.getContext('2d'), w = ov.width, H = ov.height, sx = w / tl.frames;
  g.clearRect(0, 0, w, H);
  tl.notes.forEach(function (n) {
    g.fillStyle = SCR_VOICE_COLORS[n.v];
    g.fillRect(n.f0 * sx, n.v * (H / 8), Math.max(1, (n.f1 - n.f0) * sx), H / 8 - 1);
  });
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(Math.round(f * sx), 0, 2, H);
}

function scrStopMusic() {
  if (_scr.music.raf) cancelAnimationFrame(_scr.music.raf);
  _scr.music.raf = 0;
}

function scrStartMusic() {
  scrStopMusic();
  if (typeof requestAnimationFrame !== 'function') return;
  var m = _scr.music;
  m.last = 0;
  var step = function (now) {
    var d = _scr.tracks[_scr.track];
    if (!document.getElementById('scr-lanes') || !d || !d.timeline) { m.raf = 0; return; }
    if (m.playing) {
      if (m.last) m.t += (now - m.last) / 1000;
      m.last = now;
      if (m.t >= d.timeline.seconds) { m.t = d.timeline.seconds; m.playing = false; var b = document.querySelector('[data-scr-mplay]'); if (b) b.textContent = '▶'; }
      scrDrawMusic();
    } else m.last = 0;
    m.raf = requestAnimationFrame(step);
  };
  m.raf = requestAnimationFrame(step);
}

function scrSeekMusic(canvas, e) {
  var d = _scr.tracks[_scr.track];
  if (!d || !d.timeline) return;
  var r = canvas.getBoundingClientRect();
  _scr.music.t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * d.timeline.seconds;
  scrDrawMusic();
}

function scrOnMusicMessage(msg) {
  _scr.tracks[msg.id] = { sequence: msg.sequence || null, timeline: msg.timeline || null, error: msg.error || '' };
  if (_scr.view === 'music' && msg.id === _scr.track) scrRenderMain();
}
