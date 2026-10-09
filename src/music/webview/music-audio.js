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
  mod: null,        // the spc-engine module (one per page)
};

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
  if (spc) {
    var s = spc.run(L.length * 32);
    n = Math.min(L.length, s.length >> 1);
    for (var i = 0; i < n; i++) {
      L[i] = s[2 * i] / 32768; R[i] = s[2 * i + 1] / 32768;
      peak = Math.max(peak, Math.abs(s[2 * i]), Math.abs(s[2 * i + 1]));
    }
  }
  for (var j = n; j < L.length; j++) { L[j] = 0; R[j] = 0; }
  if (spc && _muAudio.autoStop) {
    _muAudio.quiet = peak < 64 ? _muAudio.quiet + L.length : 0;
    if (_muAudio.quiet > 48000) { muStopOutput(); if (_muAudio.onStop) _muAudio.onStop(); }
  }
}

/** Plays `spc` until muStopOutput (or, with autoStop, until it falls silent). */
function muStartOutput(spc, autoStop, onStop) {
  var ctx = muAudioCtx();
  _muAudio.spc = spc; _muAudio.autoStop = !!autoStop; _muAudio.quiet = 0; _muAudio.onStop = onStop || null;
  if (!_muAudio.node) {
    _muAudio.node = ctx.createScriptProcessor(2048, 0, 2);
    _muAudio.node.onaudioprocess = muPump;
    _muAudio.node.connect(ctx.destination);
  }
}

function muStopOutput() {
  _muAudio.spc = null;
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
