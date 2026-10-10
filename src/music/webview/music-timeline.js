// Ownership: the Music tab's timeline: one frame per emulated frame (or per
// engine chunk while a track plays in the tab) in _music.history, the
// read-ahead after it (music-forecast.js), and the canvas that draws both.
//
// Who plays on a voice is never guessed: it is the driver's own owner byte
// ($6C+v, music-view.js muDriverOwners). Every command the game sends lands in
// the driver's queue, so a sound effect is seen even when several arrive in one
// frame. A box is one run of a voice owned by one effect; it restarts when the
// effect is sent again and the driver reloads the voice.

var MU_PAST_MS = 4500;               // history left of the playhead
var MU_FUTURE_MS = 1500;             // read-ahead right of it (playhead at 75%)
var MU_CAT_COLORS = { attack: '#f59e0b', anim: '#c678dd', sfx: '#f43f5e' };
var MU_CAT_ICONS = { attack: '⚔', anim: '✦', sfx: '♦' };

/** Timeline "now" (ms): the emulator's frames, or what the tab's engine has played. */
function muTimelineNow() {
  if (!muIsTrack()) return _music.timelineTime;
  return Math.max(0, (_muAudio.clockMs || 0) - (_muAudio.latencyMs || 0));
}

function muSfxInfo(id) {
  var s = _music.model && _music.model.sfx && _music.model.sfx[id];
  return { name: s ? (s.name || 'sfx ' + muHex(id, 2)) : 'sfx ' + muHex(id, 2), cat: muSfxCategory(s), source: muSfxSource(s) };
}

/**
 * The 8 voices of one frame: { on, envx, st, inst, start, own, sfx, track, gen }.
 * `rec` (history only) tracks runs: { prev: owners, gen: [8], fired: { sfx: true } }.
 */
function muSampleVoices(view, starts, drv, insts, rec) {
  if (insts && !insts._byStart) { insts._byStart = {}; insts.forEach(function (x) { insts._byStart[x.start] = x.index; }); }
  var voices = muVoices(view), owners = muDriverOwners(drv, voices), out = [];
  for (var v = 0; v < 8; v++) {
    var vo = voices[v], o = owners[v], st = muSemitones(vo.pitch);
    var inst = insts && insts._byStart[starts[v]];
    var gen = null;
    if (rec && o.kind === 'sfx') {
      var p = rec.prev && rec.prev[v];
      var fresh = !p || p.kind !== 'sfx' || p.sfx !== o.sfx;
      if (fresh || (rec.fired[o.sfx] && o.count > p.count)) rec.gen[v]++;
      gen = rec.gen[v];
    }
    out.push({
      on: !!(vo.keyed && vo.envx > 0), envx: vo.envx, st: isFinite(st) ? st : 0,
      inst: inst === undefined ? -1 : inst, start: starts[v],
      own: drv ? o.kind : '', sfx: o.kind === 'sfx' ? o.sfx : -1, track: o.track, gen: gen,
    });
  }
  if (rec) rec.prev = owners;
  return out;
}

/** The driver's new commands: sound effects to Recent, a stale read-ahead. */
function muOnDriverCommands(cmds, time) {
  var fired = {};
  cmds.forEach(function (c) {
    if (c.cmd === 0x04) {
      var id = c.param & 0xFF;
      fired[id] = true;
      _music.recentSfx[id] = time;
      _music.sfxFired = true;
      _muFc.stale = true;
    } else if (c.cmd === 0x06 || c.cmd === 0x0E) {
      muForecastClear();
      _muFc.stale = true;
    }
  });
  return fired;
}

/** Appends one frame at timeline time `time`. */
function muRecordFrame(cur, insts, time) {
  if (!cur || !cur.view || !cur.drv) return;
  var q = muDriverCommands(cur.drv, _music.queueAt);
  _music.queueAt = q.at;
  var rec = _music.runs || (_music.runs = { prev: null, gen: [0, 0, 0, 0, 0, 0, 0, 0], fired: {} });
  rec.fired = muOnDriverCommands(q.cmds, time);
  _music.history.push({ time: time, voices: muSampleVoices(cur.view, cur.starts, cur.drv, insts, rec) });
  var cutoff = time - MU_PAST_MS - 500, h = _music.history, i = 0;
  while (i < h.length - 2 && h[i].time < cutoff) i++;
  if (i) h.splice(0, i);
}

function muResetTimeline() {
  _music.history = []; _music.runs = null; _music.queueAt = -1; _music.timelineTime = 0;
  muForecastClear();
}

function muNoteColor(v, V) {
  if (V.own === 'sfx') return MU_CAT_COLORS[muSfxInfo(V.sfx).cat];
  return V.inst >= 0 ? muInstColor(V.inst) : MU_COLORS[v % MU_COLORS.length];
}

function muLaneMuted(v) { return _music.muted[v] || (_music.soloed.some(Boolean) && !_music.soloed[v]); }

/** Draws history and read-ahead (DAW style: time runs left to right, the playhead at 75%). */
function muDrawTimeline() {
  var canvas = document.getElementById('mu-tl-canvas');
  if (!canvas || !canvas.parentElement) return;
  var rect = canvas.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  var W = Math.floor(rect.width), H = Math.floor(rect.height);
  if (!W || !H) return;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  var now = muTimelineNow(), laneH = H / 8, playX = Math.round(W * MU_PAST_MS / (MU_PAST_MS + MU_FUTURE_MS));
  var k = playX / MU_PAST_MS, X = function (t) { return playX + (t - now) * k; };
  var ahead = muForecastAhead(Math.max(now, _music.history.length ? _music.history[_music.history.length - 1].time : now));
  var frames = _music.history.concat(ahead.map(function (f) { return { time: f.time, voices: f.voices, ahead: true }; }));
  var hoverLanes = muSfxLanes(_music.hoverSfxId);

  for (var v = 0; v < 8; v++) {
    ctx.fillStyle = hoverLanes.indexOf(v) >= 0 ? 'rgba(55,148,255,0.08)' : v % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, v * laneH, W, laneH);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, Math.round((v + 1) * laneH) - 1, W, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(playX, 0, W - playX, H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (var t = Math.ceil((now - MU_PAST_MS) / 1000) * 1000; t < now + MU_FUTURE_MS; t += 1000) ctx.fillRect(Math.round(X(t)), 0, 1, H);

  // Notes: one segment per frame, pitch high = up, height = envelope.
  for (v = 0; v < 8; v++) {
    var y0 = v * laneH, muted = muLaneMuted(v);
    for (var i = 1; i < frames.length; i++) {
      var V = frames[i].voices[v];
      if (!V.on) continue;
      var x1 = Math.floor(X(frames[i - 1].time)), x2 = Math.ceil(X(frames[i].time));
      if (x2 < 0 || x1 > W) continue;
      var h = Math.max(3, Math.round(laneH * 0.42 * V.envx / 127));
      var y = Math.round(y0 + laneH - 4 - h - (Math.max(-36, Math.min(12, V.st)) + 36) / 48 * (laneH - h - 8));
      ctx.fillStyle = muted ? 'rgba(110,110,110,0.35)' : muNoteColor(v, V);
      ctx.fillRect(x1, y, Math.max(1, x2 - x1), h);
    }
    muDrawSfxBoxes(ctx, frames, v, y0, laneH, X, W);
  }
  // What has not played yet is dimmed (drawn opaque first: overlapping translucent frames stripe).
  ctx.fillStyle = 'rgba(16,16,18,0.45)';
  ctx.fillRect(playX, 0, W - playX, H);

  ctx.fillStyle = '#e5c07b';
  ctx.fillRect(playX - 1, 0, 2, H);
  ctx.beginPath(); ctx.moveTo(playX - 5, 0); ctx.lineTo(playX + 5, 0); ctx.lineTo(playX, 8); ctx.fill();
  ctx.font = '10px ' + MU_CANVAS_FONT();
  ctx.fillStyle = 'rgba(204,204,204,0.55)';
  ctx.fillText(ahead.length ? 'read ahead' : (muIsTrack() || _music.live ? 'reading ahead…' : ''), playX + 8, 12);
}

var _muFont = '';
function MU_CANVAS_FONT() {
  if (!_muFont) _muFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  return _muFont;
}

/** Runs of one effect on voice v, one box each, labelled with its name and who plays it. */
function muDrawSfxBoxes(ctx, frames, v, y0, laneH, X, W) {
  var start = -1, key = null, sfx = -1, lastGen = null;
  var flush = function (endIdx) {
    if (start < 0) return;
    var x1 = X(frames[Math.max(0, start - 1)].time), x2 = X(frames[endIdx].time);
    if (x2 >= 0 && x1 <= W) muDrawSfxBox(ctx, x1, x2, y0, laneH, sfx);
    start = -1; key = null;
  };
  for (var i = 0; i < frames.length; i++) {
    var V = frames[i].voices[v];
    if (V.own !== 'sfx') { flush(i - 1 < 0 ? 0 : i - 1); continue; }
    var g = V.gen === null ? lastGen : V.gen;      // the read-ahead continues the last run
    var kk = V.sfx + ':' + g;
    if (kk !== key) { flush(Math.max(0, i - 1)); start = i; key = kk; sfx = V.sfx; }
    lastGen = g;
  }
  flush(frames.length - 1);
}

function muDrawSfxBox(ctx, x1, x2, y0, laneH, sfx) {
  var info = muSfxInfo(sfx), c = MU_CAT_COLORS[info.cat], w = Math.max(3, x2 - x1);
  var hot = _music.hoverSfxId === sfx;
  ctx.fillStyle = c + (hot ? '40' : '22');
  ctx.fillRect(x1, y0 + 2, w, laneH - 4);
  ctx.strokeStyle = c;
  ctx.lineWidth = hot ? 2 : 1;
  ctx.strokeRect(x1 + 0.5, y0 + 2.5, w - 1, laneH - 5);
  ctx.lineWidth = 1;
  if (w > 18) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x1, y0, w - 2, laneH); ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.font = '600 10px ' + MU_CANVAS_FONT();
    ctx.fillText(MU_CAT_ICONS[info.cat] + ' ' + info.name, x1 + 4, y0 + 14);
    if (info.source && laneH > 34) {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '9px ' + MU_CANVAS_FONT();
      ctx.fillText(info.source, x1 + 4, y0 + 26);
    }
    ctx.restore();
  }
}

/** Voices the driver gives effect `id` right now. */
function muSfxLanes(id) {
  var out = [], last = _music.history[_music.history.length - 1];
  if (id < 0 || !last) return out;
  last.voices.forEach(function (V, v) { if (V.own === 'sfx' && V.sfx === id) out.push(v); });
  return out;
}
