// Ownership: the Music tab's read-ahead (_muFc): a second sound chip, loaded
// with a copy of the one being shown (the tab's engine, or an emulator
// snapshot) and run ahead of the playhead, so the timeline can draw what the
// song plays next. The driver is deterministic: until the game sends another
// command, the copy plays what the real chip will. A new command (a sound
// effect, a music change) makes it stale; then it is loaded again.
// No audio: its samples are dropped.

var MU_FRAME_MS = 1000 / 60;
var MU_CLOCKS_PER_MS = 1024;          // SPC700 clocks (1.024 MHz)
var MU_FC_STEPS_PER_FRAME = 40;       // frames the read-ahead may run per drawn frame

var _muFc = {
  spc: null,        // MusicSpc of the read-ahead, or null until the engine is there
  loading: false,
  loaded: false,    // holds a copy
  t: 0,             // timeline time of its last frame (ms)
  clocks: 0,        // clocks run since it was loaded (for exact frame steps)
  base: 0,          // timeline time it was loaded at
  frames: [],       // [{ time, voices }] after the playhead, as muSampleVoices makes them
  loadedAt: 0,      // timeline time of the last load (for the emulator's refresh)
  stale: false,     // a command since the copy was taken
};

/** Loads the read-ahead with a chip state (view + ARAM) at timeline time `at`. */
function muForecastLoad(view, ram, at) {
  var go = function () {
    _muFc.spc.loadView(Uint8Array.from(view), Uint8Array.from(ram));
    _muFc.loaded = true; _muFc.stale = false;
    _muFc.t = at; _muFc.base = at; _muFc.clocks = 0; _muFc.loadedAt = at;
    _muFc.frames = [];
  };
  if (_muFc.spc) { go(); return; }
  if (_muFc.loading) return;
  _muFc.loading = true;
  // Its own module: one createSpcEngine() instance is one chip.
  createSpcEngine().then(function (mod) {
    _muFc.spc = new MusicSpc(mod); _muFc.loading = false; go();
  }).catch(function () { _muFc.loading = false; });
}

function muForecastClear() { _muFc.loaded = false; _muFc.frames = []; }

/** Runs the read-ahead until `until` (timeline ms), at most a few steps per call. */
function muForecastExtend(until, insts) {
  if (!_muFc.loaded || !_muFc.spc) return;
  var steps = 0;
  while (_muFc.t < until && steps++ < MU_FC_STEPS_PER_FRAME) {
    var next = Math.round((_muFc.t + MU_FRAME_MS - _muFc.base) * MU_CLOCKS_PER_MS);
    _muFc.spc.run(next - _muFc.clocks);
    _muFc.clocks = next;
    _muFc.t += MU_FRAME_MS;
    var ram = _muFc.spc.ram(), view = _muFc.spc.view();
    _muFc.frames.push({ time: _muFc.t, voices: muSampleVoices(view, muVoiceStarts(view, ram), muDriverBytes(ram), insts, null) });
  }
}

/** Drops what the playhead has passed; returns the frames still ahead. */
function muForecastAhead(now) {
  var f = _muFc.frames, i = 0;
  while (i < f.length && f[i].time <= now) i++;
  if (i) f.splice(0, i);
  return f;
}
