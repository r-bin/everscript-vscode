// Ownership: the Music tab's timeline: one frame per emulated frame (or per
// engine chunk while a track plays in the tab) in _music.history, the
// read-ahead after it (music-forecast.js), and the canvas that draws both.
//
// Who plays on a voice is never guessed: it is the driver's own owner byte
// ($6C+v, music-view.js muDriverOwners). Every command the game sends lands in
// the driver's queue, so a sound effect is seen even when several arrive in one
// frame. A box is one run of a voice owned by one effect; it restarts when the
// effect is sent again and the driver reloads the voice. Who sent it (the
// emulator's sound-source hook, emulator/sound-source-view.js) rides on the run.

var MU_PAST_MS = 4500;               // history left of the playhead
var MU_FUTURE_MS = 1500;             // read-ahead right of it (playhead at 75%)
var MU_SRC_MATCH_MS = 100;           // a sender event belongs to a run starting this close
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

/** "Boy (animation)", "script $93D386", "engine $8F95C1": who sent an effect. */
function muSrcLabel(src) {
  if (!src) return '';
  if (src.kind === 'anim') return (src.name || 'entity ' + muHex(src.entity || 0, 4)) + ' (animation)';
  if (src.kind === 'script') return 'script ' + muHex(src.script >>> 0, 6);
  if (src.kind === 'tab') return 'clicked in this tab';
  return 'engine code ' + muHex(src.caller >>> 0, 6);
}

/** Sender events of one emulator frame (or a click in the tab) at timeline time `time`. */
function muAddSources(list, time) {
  (list || []).forEach(function (e) {
    e.time = time;
    _music.lastSrc[e.sfx] = e;
    _music.srcSeq = (_music.srcSeq || 0) + 1;
  });
}

/**
 * The 8 voices of one frame: { on, envx, st, inst, start, own, sfx, track, gen, src }.
 * `rec` (history only) tracks runs: { prev, gen, start, src, fired, time }.
 */
function muSampleVoices(view, starts, drv, insts, rec) {
  if (insts && !insts._byStart) {
    insts._byStart = {};
    insts.forEach(function (x) { if (x.start) insts._byStart[x.start] = x.index; });
  }
  var voices = muVoices(view), owners = muDriverOwners(drv, voices), out = [];
  for (var v = 0; v < 8; v++) {
    var vo = voices[v], o = owners[v], st = muSemitones(vo.pitch), start = starts[v];
    // The DSP reads the directory only at key-on. While the driver rewrites a
    // voice's entry it can read $0000 for a frame; the voice still plays its sample.
    if (rec) { if (start) rec.start[v] = start; else start = rec.start[v]; }
    var inst = insts && start ? insts._byStart[start] : undefined;
    var gen = null, src = null;
    if (rec && o.kind === 'sfx') {
      var p = rec.prev && rec.prev[v];
      var fresh = !p || p.kind !== 'sfx' || p.sfx !== o.sfx;
      if (fresh || (rec.fired[o.sfx] && o.count > p.count)) {
        rec.gen[v]++;
        var e = _music.lastSrc[o.sfx];
        rec.src[v] = e && Math.abs(rec.time - e.time) <= MU_SRC_MATCH_MS ? e : null;
      }
      gen = rec.gen[v]; src = rec.src[v];
    }
    out.push({
      on: !!(vo.keyed && vo.envx > 0), envx: vo.envx, st: isFinite(st) ? st : 0,
      inst: inst === undefined ? -1 : inst, start: start || 0,
      own: drv ? o.kind : '', sfx: o.kind === 'sfx' ? o.sfx : -1, track: o.track, gen: gen, src: src,
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
  var rec = _music.runs || (_music.runs = { prev: null, gen: [0, 0, 0, 0, 0, 0, 0, 0], start: [0, 0, 0, 0, 0, 0, 0, 0], src: [], fired: {}, env: null });
  rec.fired = muOnDriverCommands(q.cmds, time);
  rec.time = time;
  var voices = muSampleVoices(cur.view, cur.starts, cur.drv, insts, rec);
  // Each note the real chip starts calibrates the read-ahead (music-forecast.js).
  var env = voices.map(function (V) { return V.on ? V.envx : 0; });
  if (rec.env) for (var v = 0; v < 8; v++) if (muIsNoteStart(rec.env[v], env[v]) && voices[v].own === 'mus') muForecastMatch(v, time);
  rec.env = env;
  _music.history.push({ time: time, voices: voices });
  var cutoff = time - MU_PAST_MS - 500, h = _music.history, i = 0;
  while (i < h.length - 2 && h[i].time < cutoff) i++;
  if (i) h.splice(0, i);
}

function muResetTimeline() {
  _music.history = []; _music.runs = null; _music.queueAt = -1; _music.timelineTime = 0; _music.lastSrc = {};
  muForecastClear();
}

function muNoteColor(v, V) {
  if (V.own === 'sfx') return MU_CAT_COLORS[muSfxInfo(V.sfx).cat];
  return V.inst >= 0 ? muInstColor(V.inst) : MU_COLORS[v % MU_COLORS.length];
}

function muLaneMuted(v) { return _music.muted[v] || (_music.soloed.some(Boolean) && !_music.soloed[v]); }

/** The frame geometry of the canvas, shared with the hover (music-hover.js). */
function muTimelineGeometry(W, H) {
  var now = muTimelineNow(), playX = Math.round(W * MU_PAST_MS / (MU_PAST_MS + MU_FUTURE_MS)), k = playX / MU_PAST_MS;
  var last = _music.history.length ? _music.history[_music.history.length - 1].time : now;
  var frames = _music.history.concat(muForecastAhead(Math.max(now, last)));
  return { W: W, H: H, now: now, playX: playX, k: k, laneH: H / 8, frames: frames, X: function (t) { return playX + (t - now) * k; } };
}

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

  var g = muTimelineGeometry(W, H), frames = g.frames, X = g.X, laneH = g.laneH, playX = g.playX;
  var hit = muHoverHit(g), hoverLanes = muSfxLanes(_music.hoverSfxId);

  for (var v = 0; v < 8; v++) {
    ctx.fillStyle = hoverLanes.indexOf(v) >= 0 ? 'rgba(55,148,255,0.08)' : v % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, v * laneH, W, laneH);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, Math.round((v + 1) * laneH) - 1, W, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (var t = Math.ceil((g.now - MU_PAST_MS) / 1000) * 1000; t < g.now + MU_FUTURE_MS; t += 1000) ctx.fillRect(Math.round(X(t)), 0, 1, H);

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
    muDrawSfxBoxes(ctx, frames, v, y0, laneH, X, W, hit);
  }
  // What has not played yet is dimmed (drawn opaque first: overlapping translucent frames stripe).
  ctx.fillStyle = 'rgba(16,16,18,0.45)';
  ctx.fillRect(playX, 0, W - playX, H);
  muDrawHoverMark(ctx, g, hit);

  ctx.fillStyle = '#e5c07b';
  ctx.fillRect(playX - 1, 0, 2, H);
  ctx.beginPath(); ctx.moveTo(playX - 5, 0); ctx.lineTo(playX + 5, 0); ctx.lineTo(playX, 8); ctx.fill();
  ctx.font = '10px ' + MU_CANVAS_FONT();
  ctx.fillStyle = 'rgba(204,204,204,0.55)';
  var ahead = frames.length && frames[frames.length - 1].ahead;
  ctx.fillText(ahead ? 'read ahead' : (muIsTrack() || _music.live ? 'reading ahead…' : ''), playX + 8, 12);
  if (_music.emuPaused) ctx.fillText('⏸ emulator paused · hover a note or box', 8, 12);
  muUpdateHoverTip(hit, g);
}

var _muFont = '';
function MU_CANVAS_FONT() {
  if (!_muFont) _muFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  return _muFont;
}

/** Index ranges of the effect runs on voice v: [{ sfx, first, last, src }] (the read-ahead continues the last run). */
function muSfxRuns(frames, v) {
  var runs = [], cur = null, lastGen = null;
  for (var i = 0; i < frames.length; i++) {
    var V = frames[i].voices[v];
    if (V.own !== 'sfx') { cur = null; continue; }
    var g = V.gen === null ? lastGen : V.gen, key = V.sfx + ':' + g;
    if (!cur || cur.key !== key) { cur = { key: key, sfx: V.sfx, first: i, last: i, src: V.src }; runs.push(cur); }
    cur.last = i;
    lastGen = g;
  }
  return runs;
}

/** One box per run, labelled with its name and who sent it (or, unknown, who can play it). */
function muDrawSfxBoxes(ctx, frames, v, y0, laneH, X, W, hit) {
  muSfxRuns(frames, v).forEach(function (r) {
    var x1 = X(frames[Math.max(0, r.first - 1)].time), x2 = X(frames[r.last].time);
    if (x2 < 0 || x1 > W) return;
    var hot = _music.hoverSfxId === r.sfx || !!(hit && hit.kind === 'sfx' && hit.v === v && hit.first === r.first);
    muDrawSfxBox(ctx, x1, x2, y0, laneH, r.sfx, r.src, hot);
  });
}

function muDrawSfxBox(ctx, x1, x2, y0, laneH, sfx, src, hot) {
  var info = muSfxInfo(sfx), c = MU_CAT_COLORS[info.cat], w = Math.max(3, x2 - x1);
  ctx.fillStyle = c + (hot ? '48' : '22');
  ctx.fillRect(x1, y0 + 2, w, laneH - 4);
  ctx.strokeStyle = hot ? '#fff' : c;
  ctx.lineWidth = hot ? 2 : 1;
  ctx.strokeRect(x1 + 0.5, y0 + 2.5, w - 1, laneH - 5);
  ctx.lineWidth = 1;
  if (w > 18) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x1, y0, w - 2, laneH); ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.font = '600 10px ' + MU_CANVAS_FONT();
    ctx.fillText(MU_CAT_ICONS[info.cat] + ' ' + info.name, x1 + 4, y0 + 14);
    var sub = src ? '← ' + muSrcLabel(src) : info.source;
    if (sub && laneH > 34) {
      ctx.fillStyle = src ? '#fde68a' : 'rgba(255,255,255,0.65)';
      ctx.font = '9px ' + MU_CANVAS_FONT();
      ctx.fillText(sub, x1 + 4, y0 + 26);
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
