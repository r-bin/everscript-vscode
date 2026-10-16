// Ownership: the Music tab's read-ahead (_muFc): a second sound chip, loaded
// with a copy of the one being shown (the tab's engine, or an emulator
// snapshot) and run ahead of the playhead, so the timeline can draw what the
// song plays next. The driver is deterministic: until the game sends another
// command, the copy plays what the real chip will. A new command (a sound
// effect, a music change) makes it stale; then it is loaded again.
// No audio: its samples are dropped.
//
// A copy starts with its timers at phase 0 (an SPC image has no timer phase),
// so its notes start 1-2 frames late. `shift` measures that: each note the real
// chip starts is matched with the copy's nearest one on the same voice, and the
// median difference moves the copy's frames onto the real timeline.

var MU_FRAME_MS = 1000 / 60;
var MU_CLOCKS_PER_MS = 1024;          // SPC700 clocks (1.024 MHz)
var MU_FC_STEPS_PER_FRAME = 40;       // frames the read-ahead may run per drawn frame
var MU_FC_CATCH_UP = 400;             // frames a reload may run at once (~30 ms of work)
var MU_FC_MATCH_MS = 120;             // a real note start matches a copied one this close

var _muFc = {
  spc: null,        // MusicSpc of the read-ahead, or null until the engine is there
  loading: false,
  loaded: false,    // holds a copy
  t: 0,             // copy time of its last frame (ms)
  clocks: 0,        // clocks run since it was loaded (for exact frame steps)
  base: 0,          // timeline time it was loaded at
  frames: [],       // [{ time, voices }] not yet drawn over by history, as muSampleVoices makes them
  edges: [],        // note starts in the copy: { v, t }
  prevEnv: null,    // envelopes of the copy's last frame (for edges)
  diffs: [],        // real - copy note-start differences (ms), newest last
  shift: 0,         // median of diffs: copy time + shift = timeline time
  loadedAt: 0,      // timeline time of the last load (for the emulator's refresh)
  stale: false,     // a command since the copy was taken
};

/** Loads the read-ahead with a chip state (view + ARAM) at timeline time `at`, then catches up. */
function muForecastLoad(view, ram, at, until, insts) {
  var go = function () {
    _muFc.spc.loadView(Uint8Array.from(view), Uint8Array.from(ram));
    _muFc.stale = false;
    _muFc.t = at; _muFc.base = at; _muFc.clocks = 0; _muFc.loadedAt = at;
    _muFc.edges = []; _muFc.prevEnv = null;
    // Run up to the playhead and past it before showing it: the old copy stays
    // drawn until this one has caught up, so the read-ahead never blinks.
    var frames = [];
    muForecastRun(until, insts, MU_FC_CATCH_UP, frames);
    _muFc.frames = frames; _muFc.loaded = true;
  };
  if (_muFc.spc) { go(); return; }
  if (_muFc.loading) return;
  _muFc.loading = true;
  // Its own module: one createSpcEngine() instance is one chip.
  createSpcEngine().then(function (mod) {
    _muFc.spc = new MusicSpc(mod); _muFc.loading = false; go();
  }).catch(function () { _muFc.loading = false; });
}

function muForecastClear() { _muFc.loaded = false; _muFc.frames = []; _muFc.edges = []; }

/** Steps the copy until copy time `until`, at most `max` frames, into `into`. */
function muForecastRun(until, insts, max, into) {
  var steps = 0;
  while (_muFc.t < until && steps++ < max) {
    var next = Math.round((_muFc.t + MU_FRAME_MS - _muFc.base) * MU_CLOCKS_PER_MS);
    _muFc.spc.run(next - _muFc.clocks);
    _muFc.clocks = next;
    _muFc.t += MU_FRAME_MS;
    var ram = _muFc.spc.ram(), view = _muFc.spc.view();
    var voices = muSampleVoices(view, muVoiceStarts(view, ram), muDriverBytes(ram), insts, null);
    var env = voices.map(function (V) { return V.on ? V.envx : 0; });
    if (_muFc.prevEnv) for (var v = 0; v < 8; v++) if (muIsNoteStart(_muFc.prevEnv[v], env[v])) _muFc.edges.push({ v: v, t: _muFc.t });
    _muFc.prevEnv = env;
    into.push({ time: _muFc.t, voices: voices });
  }
}

/** Runs the read-ahead until timeline time `until`, a few steps per call. */
function muForecastExtend(until, insts) {
  if (!_muFc.loaded || !_muFc.spc) return;
  muForecastRun(until - _muFc.shift, insts, MU_FC_STEPS_PER_FRAME, _muFc.frames);
}

/** A note starts: the envelope jumps up (key-on) after silence or a decay. */
function muIsNoteStart(before, after) { return after > 0 && after > before + 24; }

/** A note the real chip started on voice v at timeline time t: measure the copy against it. */
function muForecastMatch(v, t) {
  var best = null, e = _muFc.edges;
  for (var i = 0; i < e.length; i++) {
    if (e[i].v !== v) continue;
    var d = t - e[i].t;
    if (Math.abs(d) <= MU_FC_MATCH_MS && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  while (e.length && e[0].t < t - 2000) e.shift();
  if (best === null) return;
  _muFc.diffs.push(best);
  if (_muFc.diffs.length > 15) _muFc.diffs.shift();
  var sorted = _muFc.diffs.slice().sort(function (a, b) { return a - b; });
  _muFc.shift = sorted[sorted.length >> 1];
}

/** Drops what history has drawn over (timeline time `from`); returns the frames ahead, on the timeline. */
function muForecastAhead(from) {
  var f = _muFc.frames, i = 0, s = _muFc.shift;
  while (i < f.length && f[i].time + s <= from) i++;
  if (i) f.splice(0, i);
  return f.map(function (x) { return { time: x.time + s, voices: x.voices, ahead: true }; });
}
