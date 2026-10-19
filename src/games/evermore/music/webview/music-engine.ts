// Ownership: the Music tab's own sound chip (engine/spc-engine.js, blargg's
// SPC700 + S-DSP) and the 65816's side of the port protocol, as bank $8C
// speaks it (everscript docs/audio_music_sound_formats.md §3):
//   $8C:81FD  wait for the echo on port 2, bump the counter (never 0), write
//             param to ports 0/1, counter to port 2, command to port 3
//   $0E       the driver jumps to the IPL ROM; the package is copied in and
//             the driver restarts at $0700; then $02
//   music M   $1C $8080, $1A 0, upload package, $06 M      sfx S   $04 S
// The host imports it; the page gets the same code as dist/webview/music-engine.js (tools/bundle-pages.mts),
// loaded after spc-engine.js, with its exports set as globals. No DOM.

const MUSIC_CMD = { afterUpload: 0x02, sfx: 0x04, music: 0x06, upload: 0x0E, stopB: 0x1A, stopA: 0x1C, volume: 0x28 };
const MUSIC_STEP_CLOCKS = 64;           // granularity while waiting on the driver
const MUSIC_WAIT_LIMIT = 4000000;       // ~4 s of SPC time before giving up

/** The instantiated spc-engine module (the emscripten glue, engine/spc-engine.js) as far as the chip uses it. */
interface SpcModule {
  HEAPU8: Uint8Array; HEAP16: Int16Array;
  _se_init(): void; _se_ram(): number; _se_view(): number; _se_out(i: number): number; _se_run(clocks: number): number; _se_samples(): number;
  _se_pc(): number; _se_set_cpu(pc: number, a: number, x: number, y: number, psw: number, sp: number): void;
  _se_set_out(i: number, v: number): void; _se_set_in(i: number, v: number): void; _se_load(ptr: number): void;
  _malloc(n: number): number; _free(ptr: number): void;
}
/** A block of bytes to write into ARAM at `dest` (the driver, a package record). */
interface Record_ { dest: number; bytes: ArrayLike<number> & { slice(start: number, end?: number): ArrayLike<number> } }

/** One SPC700 + DSP. `mod` is the instantiated spc-engine module. */
class MusicSpc {
  mod: SpcModule;
  counter: number;

  constructor(mod: SpcModule) {
    this.mod = mod;
    mod._se_init();
    this.counter = 1;
  }

  ram(): Uint8Array {
    const p = this.mod._se_ram();
    return this.mod.HEAPU8.subarray(p, p + 0x10000);
  }

  /** 224 bytes, laid out like the emulator core's getApuView (see music-view.ts). */
  view(): Uint8Array {
    const p = this.mod._se_view();
    return this.mod.HEAPU8.slice(p, p + 224);
  }

  out(i: number): number { return this.mod._se_out(i); }

  /** Runs `clocks` SPC clocks; returns the int16 stereo samples made. */
  run(clocks: number): Int16Array {
    const n = this.mod._se_run(clocks);
    const p = this.mod._se_samples() >> 1;
    return this.mod.HEAP16.subarray(p, p + n);
  }

  runUntil(cond: () => boolean, what: string): void {
    for (let t = 0; t < MUSIC_WAIT_LIMIT; t += MUSIC_STEP_CLOCKS) {
      if (cond()) return;
      this.run(MUSIC_STEP_CLOCKS);
    }
    throw new Error('The sound driver did not ' + what + ' (PC $' + this.mod._se_pc().toString(16) + ')');
  }

  /** State after the IPL's JMP [$0000+X] into the driver. */
  restart(entry: number): void {
    const ram = this.ram();
    ram[0] = entry & 0xFF; ram[1] = entry >> 8;
    this.mod._se_set_cpu(entry, 0xCC, 0, 0, 0x02, 0xEF);
    const outs = [0xCC, 0, 0, 0], ins = [0xCC, 0, entry & 0xFF, entry >> 8];
    for (let i = 0; i < 4; i++) { this.mod._se_set_out(i, outs[i]); this.mod._se_set_in(i, ins[i]); }
    this.counter = 1;
  }

  waitAck(): void {
    this.runUntil(() => this.out(2) === this.counter, 'answer');
  }

  send(cmd: number, param?: number): void {
    param = param || 0;
    this.waitAck();
    this.counter = (this.counter + 1) & 0xFF || 1;
    const ins = [param & 0xFF, param >> 8, this.counter, cmd];
    for (let i = 0; i < 4; i++) this.mod._se_set_in(i, ins[i]);
  }

  command(cmd: number, param?: number): void { this.send(cmd, param); this.waitAck(); }

  write(records: Record_[]): void {
    const ram = this.ram();
    records.forEach((r) => { ram.set(r.bytes.slice(0, 0x10000 - r.dest), r.dest); });
  }

  /** $0E, the package copied in where the IPL would put it, restart, $02. */
  upload(records: Record_[]): void {
    this.send(MUSIC_CMD.upload);
    this.runUntil(() => (this.mod._se_pc() & 0xFFC0) === 0xFFC0 && this.out(0) === 0xAA && this.out(1) === 0xBB, 'enter the IPL ROM');
    this.write(records);
    this.restart(0x0700);
    this.command(MUSIC_CMD.afterUpload);
  }

  /** Power-on as $8C:801F: the driver, then package 0. */
  boot(driver: { blocks: Record_[]; entry: number }, basePackage: Record_[]): void {
    this.write(driver.blocks);
    this.restart(driver.entry);
    this.upload(basePackage);
  }

  /** $8C:828F with the package always uploaded. */
  playMusic(music: number, records: Record_[]): void {
    this.command(MUSIC_CMD.stopA, 0x8080);
    this.command(MUSIC_CMD.stopB, 0);
    this.upload(records);
    this.command(MUSIC_CMD.music, music);
  }

  playSfx(sfx: number): void { this.command(MUSIC_CMD.sfx, sfx); }
  setMusicVolume(v: number): void { this.command(MUSIC_CMD.volume, v); }

  /**
   * Takes over another chip's state: an emulator view (getApuView, 224 bytes)
   * and its 64 KB ARAM, as an SPC image. The driver keeps running from there;
   * the next command continues its counter.
   */
  loadView(view: Uint8Array, ram: Uint8Array): void {
    const img = new Uint8Array(0x10200), mod = this.mod;
    img[0x25] = view[4]; img[0x26] = view[5];
    img[0x27] = view[6]; img[0x28] = view[7]; img[0x29] = view[8]; img[0x2A] = view[9]; img[0x2B] = view[10];
    img.set(ram, 0x100);
    img[0x100 + 0xF1] = view[11];
    for (let i = 0; i < 4; i++) img[0x100 + 0xF4 + i] = view[12 + i];
    for (let i = 0; i < 3; i++) img[0x100 + 0xFA + i] = view[20 + i];
    img.set(view.subarray(32, 160), 0x10100);
    img.set(view[24] ? view.subarray(160, 224) : ram.subarray(0xFFC0), 0x101C0);
    const p = mod._malloc(img.length);
    mod.HEAPU8.set(img, p);
    mod._se_load(p);
    mod._free(p);
    for (let i = 0; i < 4; i++) mod._se_set_out(i, view[16 + i]);
    this.counter = view[18];
  }
}

export type { SpcModule };
export { MusicSpc, MUSIC_CMD };
