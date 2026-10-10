// Ownership: pure helpers of the Music tab: reading the 224-byte sound-chip
// view (the emulator core's getApuView and the engine's se_view share it),
// BRR samples, the instrument list and who owns each ARAM byte. No DOM.
//
// View: +4 PC  +6 A +7 X +8 Y +9 PSW +10 SP  +11 $F1  +12 ports in  +16 ports out
//       +20 timer targets  +23 timers on  +24 IPL ROM mapped  +25 keyed voices
//       +32 DSP registers (voice v at +32 + 16v: VOL L/R, P L/H, SRCN, ADSR 1/2, GAIN, ENVX, OUTX)

var MU_DSP = 32;
var MU_DIR_TABLE = 0x1F00;   // the driver's sample directory, 4 bytes per sample

/** Per-voice state from a view: { srcn, pitch, volL, volR, envx, keyed }. */
function muVoices(view) {
  var out = [];
  for (var v = 0; v < 8; v++) {
    var b = MU_DSP + v * 16, s8 = function (x) { return x > 127 ? x - 256 : x; };
    out.push({
      srcn: view[b + 4],
      pitch: (view[b + 2] | view[b + 3] << 8) & 0x3FFF,
      volL: s8(view[b]), volR: s8(view[b + 1]),
      envx: view[b + 8] & 0x7F,
      keyed: !!(view[25] >> v & 1),
    });
  }
  return out;
}

/** Each voice's sample start: its directory entry (DIR·256 + SRCN·4) in `ram`. */
function muVoiceStarts(view, ram) {
  var dir = view[MU_DSP + 0x5D] * 256, out = [];
  for (var v = 0; v < 8; v++) { var e = (dir + view[MU_DSP + v * 16 + 4] * 4) & 0xFFFF; out.push(ram[e] | ram[e + 1] << 8); }
  return out;
}

/** Semitones from the sample's own rate (pitch $1000). */
function muSemitones(pitch) { return pitch ? 12 * Math.log2(pitch / 0x1000) : -Infinity; }

/** The echo buffer the DSP is told to use: [start, end) or null. */
function muEcho(view) {
  var esa = view[MU_DSP + 0x6D] * 256, edl = view[MU_DSP + 0x7D] & 0x0F;
  return [esa, Math.min(0x10000, esa + (edl ? edl * 2048 : 4))];
}

/**
 * BRR from `start` until its END block: { pcm: Float32Array (-1..1), loopAt
 * (sample index or -1), blocks }. Filters as the S-DSP decodes them.
 */
function muDecodeBrr(ram, start, loop) {
  var pcm = [], old = 0, older = 0, a = start, loopAt = -1, blocks = 0;
  for (; blocks < 4096; blocks++) {
    if (a === loop) loopAt = pcm.length;
    var hdr = ram[a & 0xFFFF], shift = hdr >> 4, filter = hdr >> 2 & 3;
    for (var i = 0; i < 16; i++) {
      var byte = ram[(a + 1 + (i >> 1)) & 0xFFFF];
      var s = (i & 1) ? byte & 0x0F : byte >> 4;
      if (s > 7) s -= 16;
      s = shift <= 12 ? (s << shift) >> 1 : (s < 0 ? -2048 : 0);
      if (filter === 1) s += old + (-old >> 4);
      else if (filter === 2) s += old * 2 + ((-old * 3) >> 5) - older + (older >> 4);
      else if (filter === 3) s += old * 2 + ((-old * 13) >> 6) - older + ((older * 3) >> 4);
      s = Math.max(-32768, Math.min(32767, s));
      s = ((s * 2) << 16) >> 16;
      older = old; old = s;
      pcm.push(s / 32768);
    }
    a += 9;
    if (hdr & 1) { blocks++; return { pcm: Float32Array.from(pcm), loopAt: hdr & 2 ? loopAt : -1, blocks: blocks }; }
  }
  return { pcm: Float32Array.from(pcm), loopAt: -1, blocks: blocks };
}

/**
 * The instruments in ARAM: the sample-directory entries package 0 and the
 * loaded package write, with start/loop read from ARAM itself.
 * [{ index, start, loop, from: 'base'|'song', bytes }]
 */
function muInstruments(ram, baseLayout, songLayout) {
  var byIndex = {};
  [[baseLayout, 'base'], [songLayout || [], 'song']].forEach(function (p) {
    p[0].forEach(function (r) {
      if (r[0] < MU_DIR_TABLE || r[0] >= MU_DIR_TABLE + 0x100) return;
      for (var at = r[0]; at + 4 <= r[0] + r[1]; at += 4) byIndex[(at - MU_DIR_TABLE) >> 2] = p[1];
    });
  });
  return Object.keys(byIndex).map(Number).sort(function (a, b) { return a - b; }).map(function (i) {
    var e = MU_DIR_TABLE + i * 4, start = ram[e] | ram[e + 1] << 8, loop = ram[e + 2] | ram[e + 3] << 8;
    var brr = muDecodeBrr(ram, start, loop);
    return { index: i, start: start, loop: loop, from: byIndex[i], bytes: brr.blocks * 9 };
  });
}

var MU_OWNERS = [
  { key: 'zp', name: 'Zero page, I/O & stack' },
  { key: 'driver', name: 'Driver' },
  { key: 'tables', name: 'Driver tables & sample directory' },
  { key: 'base', name: 'Base-bank samples (package $00)' },
  { key: 'song', name: 'Song samples' },
  { key: 'data', name: 'Song & effect data' },
  { key: 'echo', name: 'Echo buffer' },
  { key: 'ipl', name: 'IPL ROM' },
];

/**
 * One owner per ARAM byte (index into MU_OWNERS, -1 = free), from the driver
 * blocks, package 0, the loaded package and the echo buffer. Later writes win,
 * as they do in ARAM.
 */
function muOwners(driver, baseLayout, songLayout, echo) {
  var own = new Int8Array(0x10000).fill(-1);
  var idx = {};
  MU_OWNERS.forEach(function (o, i) { idx[o.key] = i; });
  var put = function (a, n, k) { own.fill(idx[k], a, Math.min(0x10000, a + n)); };
  put(0, 0x220, 'zp');
  driver.blocks.forEach(function (b) { put(b.dest, b.bytes.length, 'driver'); });
  [[baseLayout, true], [songLayout || [], false]].forEach(function (p) {
    p[0].forEach(function (r) {
      var k = r[0] < 0x2400 ? 'tables' : p[1] ? 'base' : r[1] >= 256 ? 'song' : 'data';
      put(r[0], r[1], k);
    });
  });
  if (echo) put(echo[0], echo[1] - echo[0], 'echo');
  put(0xFFC0, 0x40, 'ipl');
  return own;
}

/** Contiguous runs of one owner: [{ owner, start, end }]. */
function muRuns(own) {
  var out = [], start = 0;
  for (var a = 1; a <= 0x10000; a++) {
    if (a === 0x10000 || own[a] !== own[start]) { out.push({ owner: own[start], start: start, end: a }); start = a; }
  }
  return out;
}

/** Computes total bytes in a package layout: sum of record lengths. */
function muPackageBytes(pkgLayout) {
  if (!pkgLayout) return 0;
  return pkgLayout.reduce(function (sum, r) { return sum + (r[1] || 0); }, 0);
}

/*
 * The driver's own bookkeeping (disassembly of the ROM driver, src/music/README.md).
 * `drv` holds these ARAM ranges in this order, as the emulator's stream sends
 * them (emulator/apu-stream-view.js APU_DRIVER_RANGES) and muDriverBytes reads them:
 *   $6C+v   owner of voice v: $80 a sound effect, $01 a music track, $00 free
 *   $D1+v   music track of voice v ($80 | track)
 *   $011B+v sound effect of voice v (written by the $04 handler, $0CC2)
 *   $75+2v  countdown of voice v's current note; reloaded when the voice is assigned.
 *           When an effect's last note runs out it wraps past 0 ($FFxx), but $6C+v keeps
 *           $80 until a music track takes the voice back (seen with Dog Bark, $10).
 *   $EA     write index of the command queue; the queue: cmd $1043+i, param $1053+i / $1063+i (16 entries)
 */
var MU_DRV_RANGES = [[0x6C, 8], [0xD1, 8], [0x11B, 8], [0x75, 16], [0xEA, 1], [0x1043, 48]];
var MU_DRV = { owner: 0, track: 8, sfx: 16, count: 24, queueAt: 40, queue: 41 };

/** `drv` from a whole ARAM (the tab's own engine). */
function muDriverBytes(ram) {
  var out = [];
  MU_DRV_RANGES.forEach(function (r) { for (var i = 0; i < r[1]; i++) out.push(ram[r[0] + i]); });
  return out;
}

/**
 * Who owns each voice: [{ kind: 'sfx'|'mus'|'', sfx, track, count }]. With the
 * view's `voices` (muVoices), an effect whose countdown has wrapped on a silent
 * voice has ended: kind '' (the driver still holds the voice for music).
 */
function muDriverOwners(drv, voices) {
  var out = [];
  for (var v = 0; v < 8; v++) {
    var o = drv ? drv[MU_DRV.owner + v] : 0;
    var count = drv ? drv[MU_DRV.count + 2 * v] | drv[MU_DRV.count + 2 * v + 1] << 8 : 0;
    var kind = o & 0x80 ? 'sfx' : o ? 'mus' : '';
    if (kind === 'sfx' && voices && count >= 0x8000 && !(voices[v].keyed && voices[v].envx)) kind = '';
    out.push({ kind: kind, sfx: drv ? drv[MU_DRV.sfx + v] : -1, track: drv ? drv[MU_DRV.track + v] & 0x7F : -1, count: count });
  }
  return out;
}

/** Commands queued since write index `from`: { at (new index), cmds: [{ cmd, param }] }. */
function muDriverCommands(drv, from) {
  var at = drv[MU_DRV.queueAt] & 15, cmds = [];
  if (from < 0) return { at: at, cmds: cmds };
  for (var i = from & 15; i !== at; i = (i + 1) & 15) {
    cmds.push({ cmd: drv[MU_DRV.queue + i], param: drv[MU_DRV.queue + 16 + i] | drv[MU_DRV.queue + 32 + i] << 8 });
  }
  return { at: at, cmds: cmds };
}

/**
 * What a sound effect is, from the animations that play it (model sfx
 * `animations`, from localizations/data/sound-animations.json): 'attack' when
 * an attack animation plays it, 'anim' when another animation does, else 'sfx'.
 */
function muSfxCategory(sfx) {
  var a = (sfx && sfx.animations) || [];
  if (a.some(function (x) { return x.attack; })) return 'attack';
  return a.length ? 'anim' : 'sfx';
}

/** "Bone Crusher, Horn Spear +8": who plays an effect, for labels. */
function muSfxSource(sfx, max) {
  var a = (sfx && sfx.animations) || [], names = [];
  var pick = a.some(function (x) { return x.attack; }) ? a.filter(function (x) { return x.attack; }) : a;
  pick.forEach(function (x) { if (names.indexOf(x.who) < 0) names.push(x.who); });
  max = max || 2;
  return names.slice(0, max).join(', ') + (names.length > max ? ' +' + (names.length - max) : '');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { muVoices: muVoices, muVoiceStarts: muVoiceStarts, muSemitones: muSemitones, muEcho: muEcho, muDecodeBrr: muDecodeBrr,
    muInstruments: muInstruments, muOwners: muOwners, muRuns: muRuns, MU_OWNERS: MU_OWNERS,
    muPackageBytes: muPackageBytes, MU_DRV_RANGES: MU_DRV_RANGES, muDriverBytes: muDriverBytes,
    muDriverOwners: muDriverOwners, muDriverCommands: muDriverCommands, muSfxCategory: muSfxCategory, muSfxSource: muSfxSource };
}

