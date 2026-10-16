// Ownership: the Music tab's own sound chip (engine/spc-engine.js, blargg's
// SPC700 + S-DSP) and the 65816's side of the port protocol, as bank $8C
// speaks it (everscript docs/audio_music_sound_formats.md §3):
//   $8C:81FD  wait for the echo on port 2, bump the counter (never 0), write
//             param to ports 0/1, counter to port 2, command to port 3
//   $0E       the driver jumps to the IPL ROM; the package is copied in and
//             the driver restarts at $0700; then $02
//   music M   $1C $8080, $1A 0, upload package, $06 M      sfx S   $04 S
// The page loads it after spc-engine.js; tests load it with vm (no DOM).

var MUSIC_CMD = { afterUpload: 0x02, sfx: 0x04, music: 0x06, upload: 0x0E, stopB: 0x1A, stopA: 0x1C, volume: 0x28 };
var MUSIC_STEP_CLOCKS = 64;           // granularity while waiting on the driver
var MUSIC_WAIT_LIMIT = 4000000;       // ~4 s of SPC time before giving up

/** One SPC700 + DSP. `mod` is the instantiated spc-engine module. */
function MusicSpc(mod) {
  this.mod = mod;
  mod._se_init();
  this.counter = 1;
}

MusicSpc.prototype.ram = function () {
  var p = this.mod._se_ram();
  return this.mod.HEAPU8.subarray(p, p + 0x10000);
};

/** 224 bytes, laid out like the emulator core's getApuView (see music-view.js). */
MusicSpc.prototype.view = function () {
  var p = this.mod._se_view();
  return this.mod.HEAPU8.slice(p, p + 224);
};

MusicSpc.prototype.out = function (i) { return this.mod._se_out(i); };

/** Runs `clocks` SPC clocks; returns the int16 stereo samples made. */
MusicSpc.prototype.run = function (clocks) {
  var n = this.mod._se_run(clocks);
  var p = this.mod._se_samples() >> 1;
  return this.mod.HEAP16.subarray(p, p + n);
};

MusicSpc.prototype.runUntil = function (cond, what) {
  for (var t = 0; t < MUSIC_WAIT_LIMIT; t += MUSIC_STEP_CLOCKS) {
    if (cond()) return;
    this.run(MUSIC_STEP_CLOCKS);
  }
  throw new Error('The sound driver did not ' + what + ' (PC $' + this.mod._se_pc().toString(16) + ')');
};

/** State after the IPL's JMP [$0000+X] into the driver. */
MusicSpc.prototype.restart = function (entry) {
  var ram = this.ram();
  ram[0] = entry & 0xFF; ram[1] = entry >> 8;
  this.mod._se_set_cpu(entry, 0xCC, 0, 0, 0x02, 0xEF);
  var outs = [0xCC, 0, 0, 0], ins = [0xCC, 0, entry & 0xFF, entry >> 8];
  for (var i = 0; i < 4; i++) { this.mod._se_set_out(i, outs[i]); this.mod._se_set_in(i, ins[i]); }
  this.counter = 1;
};

MusicSpc.prototype.waitAck = function () {
  var self = this;
  this.runUntil(function () { return self.out(2) === self.counter; }, 'answer');
};

MusicSpc.prototype.send = function (cmd, param) {
  param = param || 0;
  this.waitAck();
  this.counter = (this.counter + 1) & 0xFF || 1;
  var ins = [param & 0xFF, param >> 8, this.counter, cmd];
  for (var i = 0; i < 4; i++) this.mod._se_set_in(i, ins[i]);
};

MusicSpc.prototype.command = function (cmd, param) { this.send(cmd, param); this.waitAck(); };

MusicSpc.prototype.write = function (records) {
  var ram = this.ram();
  records.forEach(function (r) { ram.set(r.bytes.slice(0, 0x10000 - r.dest), r.dest); });
};

/** $0E, the package copied in where the IPL would put it, restart, $02. */
MusicSpc.prototype.upload = function (records) {
  var self = this;
  this.send(MUSIC_CMD.upload);
  this.runUntil(function () {
    return (self.mod._se_pc() & 0xFFC0) === 0xFFC0 && self.out(0) === 0xAA && self.out(1) === 0xBB;
  }, 'enter the IPL ROM');
  this.write(records);
  this.restart(0x0700);
  this.command(MUSIC_CMD.afterUpload);
};

/** Power-on as $8C:801F: the driver, then package 0. */
MusicSpc.prototype.boot = function (driver, basePackage) {
  this.write(driver.blocks);
  this.restart(driver.entry);
  this.upload(basePackage);
};

/** $8C:828F with the package always uploaded. */
MusicSpc.prototype.playMusic = function (music, records) {
  this.command(MUSIC_CMD.stopA, 0x8080);
  this.command(MUSIC_CMD.stopB, 0);
  this.upload(records);
  this.command(MUSIC_CMD.music, music);
};

MusicSpc.prototype.playSfx = function (sfx) { this.command(MUSIC_CMD.sfx, sfx); };
MusicSpc.prototype.setMusicVolume = function (v) { this.command(MUSIC_CMD.volume, v); };

/**
 * Takes over another chip's state: an emulator view (getApuView, 224 bytes)
 * and its 64 KB ARAM, as an SPC image. The driver keeps running from there;
 * the next command continues its counter.
 */
MusicSpc.prototype.loadView = function (view, ram) {
  var img = new Uint8Array(0x10200), mod = this.mod;
  img[0x25] = view[4]; img[0x26] = view[5];
  img[0x27] = view[6]; img[0x28] = view[7]; img[0x29] = view[8]; img[0x2A] = view[9]; img[0x2B] = view[10];
  img.set(ram, 0x100);
  img[0x100 + 0xF1] = view[11];
  for (var i = 0; i < 4; i++) img[0x100 + 0xF4 + i] = view[12 + i];
  for (i = 0; i < 3; i++) img[0x100 + 0xFA + i] = view[20 + i];
  img.set(view.subarray(32, 160), 0x10100);
  img.set(view[24] ? view.subarray(160, 224) : ram.subarray(0xFFC0), 0x101C0);
  var p = mod._malloc(img.length);
  mod.HEAPU8.set(img, p);
  mod._se_load(p);
  mod._free(p);
  for (i = 0; i < 4; i++) mod._se_set_out(i, view[16 + i]);
  this.counter = view[18];
};

if (typeof module !== 'undefined' && module.exports) module.exports = { MusicSpc: MusicSpc, MUSIC_CMD: MUSIC_CMD };
