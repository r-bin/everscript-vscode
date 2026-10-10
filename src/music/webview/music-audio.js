// Ownership: sound out of the Music tab: the engine's samples through WebAudio
// (32 kHz, the S-DSP's own rate) and instrument previews decoded from BRR.
// Owns _muAudio. Browsers only start audio after a click, so everything here
// is reached from a click handler.

var _muAudio = {
  ctx: null,
  node: null,       // ScriptProcessor pulling the engine
  spc: null,        // the MusicSpc being played, or null
  autoStop: false,  // stop after 1.5 s of silence (a sound effect over a muted song)
  quiet: 0,         // frames of silence so far
  onStop: null,     // called when playback stops by itself
  onChunk: null,    // called after every MU_CHUNK samples with the clock (a track's timeline)
  clockMs: 0,       // time the engine has made since muStartOutput (ms)
  latencyMs: 0,     // made but not heard yet: the output buffer
  mod: null,        // the spc-engine module (one per page)
};

var MU_BUFFER = 2048;   // samples per output callback
var MU_CHUNK = 512;     // samples per engine run (16 ms: the timeline's resolution)

function muAudioCtx() {
  if (!_muAudio.ctx) _muAudio.ctx = new AudioContext({ sampleRate: 32000 });
  if (_muAudio.ctx.state === 'suspended') _muAudio.ctx.resume();
  return _muAudio.ctx;
}

/** The engine module, instantiated once (spc-engine.js defines createSpcEngine). */
function muEngine() {
  if (!_muAudio.mod) _muAudio.mod = createSpcEngine();
  return _muAudio.mod;
}

function muPump(e) {
  var L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1);
  var spc = _muAudio.spc, n = 0, peak = 0;
  while (spc && n < L.length) {
    var want = Math.min(MU_CHUNK, L.length - n), s = spc.run(want * 32), got = Math.min(want, s.length >> 1);
    for (var i = 0; i < got; i++) {
      L[n + i] = s[2 * i] / 32768; R[n + i] = s[2 * i + 1] / 32768;
      peak = Math.max(peak, Math.abs(s[2 * i]), Math.abs(s[2 * i + 1]));
    }
    n += got;
    _muAudio.clockMs += want / 32;
    if (_muAudio.onChunk) _muAudio.onChunk(spc, _muAudio.clockMs);
    if (!got) break;
  }
  for (var j = n; j < L.length; j++) { L[j] = 0; R[j] = 0; }
  if (spc && _muAudio.autoStop) {
    _muAudio.quiet = peak < 64 ? _muAudio.quiet + L.length : 0;
    if (_muAudio.quiet > 48000) { muStopOutput(); if (_muAudio.onStop) _muAudio.onStop(); }
  }
}

/**
 * Plays `spc` until muStopOutput (or, with autoStop, until it falls silent).
 * `onChunk(spc, clockMs)` runs after every chunk the engine makes.
 */
function muStartOutput(spc, autoStop, onStop, onChunk) {
  var ctx = muAudioCtx();
  _muAudio.spc = spc; _muAudio.autoStop = !!autoStop; _muAudio.quiet = 0; _muAudio.onStop = onStop || null;
  _muAudio.onChunk = onChunk || null; _muAudio.clockMs = 0;
  _muAudio.latencyMs = MU_BUFFER / 32 + (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
  if (!_muAudio.node) {
    _muAudio.node = ctx.createScriptProcessor(MU_BUFFER, 0, 2);
    _muAudio.node.onaudioprocess = muPump;
    _muAudio.node.connect(ctx.destination);
  }
}

function muStopOutput() {
  _muAudio.spc = null; _muAudio.onChunk = null;
  if (_muAudio.node) { _muAudio.node.disconnect(); _muAudio.node = null; }
}

/** One instrument from ARAM at `semis` semitones from its own rate. */
function muPreview(ram, inst, semis) {
  var ctx = muAudioCtx(), brr = muDecodeBrr(ram, inst.start, inst.loop);
  if (!brr.pcm.length) return;
  var buf = ctx.createBuffer(1, brr.pcm.length, 32000);
  buf.getChannelData(0).set(brr.pcm);
  var src = ctx.createBufferSource(), gain = ctx.createGain(), rate = Math.pow(2, semis / 12);
  src.buffer = buf;
  src.playbackRate.value = rate;
  var dur = brr.pcm.length / 32000 / rate;
  if (brr.loopAt >= 0) {
    src.loop = true; src.loopStart = brr.loopAt / 32000; src.loopEnd = brr.pcm.length / 32000;
    dur = Math.max(dur, 1.2);
  }
  dur = Math.min(dur, 4);
  var t = ctx.currentTime;
  gain.gain.setValueAtTime(0.7, t);
  gain.gain.setTargetAtTime(0, t + Math.max(0.05, dur - 0.15), 0.05);
  src.connect(gain); gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.3);
}
