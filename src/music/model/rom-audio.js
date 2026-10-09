'use strict';
// Ownership: the sound data of a Secret of Evermore ROM, as the 65816 uploads
// it. Pure: ROM bytes in, plain objects out.
//
// Verified by disassembly of bank $8C and by running the driver (everscript
// docs/audio_music_sound_formats.md):
//   $81:80DC  IPL block list [len:16][dest:16] data..., len 0 ends (dest = entry)
//   $81:9900  last package index ($46: 71 packages)
//   $81:9901  music count ($46: music ids 0x00..0x45)
//   $81:9902  sound-effect count ($5A: driver sfx 0x00..0x59)
//   $81:9903  71 x 24-bit package pointers, then music -> package, then sfx -> package
//   $8C:8362  script sfx id / 2 -> driver sfx (word; $FFFF = muted)
// A package is [count:16] then count x [len:16][src:24][spc_dest:16]; every
// read walks bank upper halves only (past $xx:FFFF it continues at the next
// bank's $8000).

const DRIVER_BLOCK = 0x0180DC;
const LAST_PACKAGE = 0x019900;
const MUSIC_COUNT = 0x019901;
const SFX_COUNT = 0x019902;
const PACKAGE_POINTERS = 0x019903;
const SCRIPT_SFX = 0x0C8362;
const SCRIPT_SFX_WORDS = 120;

/** True when the ROM has Secret of Evermore (U)'s sound tables. */
function isEvermoreAudio(rom) {
    return !!rom && rom.length >= 0x300000 && rom[LAST_PACKAGE] === 0x46 && rom[MUSIC_COUNT] === 0x46 && rom[SFX_COUNT] === 0x5A;
}

/** n bytes from `cur`, upper halves only; returns { bytes, next }. */
function readUpper(rom, cur, n) {
    const bytes = new Uint8Array(n);
    let at = 0;
    while (at < n) {
        const k = Math.min(n - at, ((cur | 0xFFFF) + 1) - cur);
        bytes.set(rom.subarray(cur, cur + k), at);
        at += k;
        cur += k;
        if ((cur & 0xFFFF) === 0) cur += 0x8000;
    }
    if ((cur & 0xFFFF) === 0) cur += 0x8000;
    return { bytes, next: cur };
}

const r24 = (rom, o) => rom[o] | rom[o + 1] << 8 | rom[o + 2] << 16;

/** [{ dest, bytes }] of one package, in upload order. */
function packageRecords(rom, id) {
    let cur = r24(rom, PACKAGE_POINTERS + id * 3) & 0x3FFFFF;
    let r = readUpper(rom, cur, 2);
    const count = r.bytes[0] | r.bytes[1] << 8;
    cur = r.next;
    const out = [];
    for (let i = 0; i < count; i++) {
        r = readUpper(rom, cur, 7);
        cur = r.next;
        const b = r.bytes;
        const len = b[0] | b[1] << 8;
        const src = (b[2] | b[3] << 8 | b[4] << 16) & 0x3FFFFF;
        const dest = b[5] | b[6] << 8;
        out.push({ dest, bytes: readUpper(rom, src, len).bytes });
    }
    return out;
}

/** The driver: { blocks: [{ dest, bytes }], entry }. */
function driverBlocks(rom) {
    const blocks = [];
    let cur = DRIVER_BLOCK;
    for (;;) {
        const len = rom[cur] | rom[cur + 1] << 8;
        const dest = rom[cur + 2] | rom[cur + 3] << 8;
        if (len === 0) return { blocks, entry: dest };
        blocks.push({ dest, bytes: rom.subarray(cur + 4, cur + 4 + len) });
        cur += 4 + len;
    }
}

function tables(rom) {
    const packages = rom[LAST_PACKAGE] + 1;
    const musicTable = PACKAGE_POINTERS + packages * 3;
    const musicCount = rom[MUSIC_COUNT];
    return { packages, musicTable, musicCount, sfxTable: musicTable + musicCount, sfxCount: rom[SFX_COUNT] };
}

/** Package of each music id. */
function musicPackages(rom) {
    const t = tables(rom);
    return Array.from({ length: t.musicCount }, (_, m) => rom[t.musicTable + m]);
}

/** Package of each driver sfx (0 = the base bank). */
function sfxPackages(rom) {
    const t = tables(rom);
    return Array.from({ length: t.sfxCount }, (_, s) => rom[t.sfxTable + s]);
}

/** driver sfx -> the script ids (sound() parameters) that reach it. */
function scriptIdsBySfx(rom) {
    const out = new Map();
    for (let i = 0; i < SCRIPT_SFX_WORDS; i++) {
        const v = rom[SCRIPT_SFX + 2 * i] | rom[SCRIPT_SFX + 2 * i + 1] << 8;
        if (v === 0xFFFF) continue;
        if (!out.has(v)) out.set(v, []);
        out.get(v).push(2 * i);
    }
    return out;
}

module.exports = { isEvermoreAudio, packageRecords, driverBlocks, musicPackages, sfxPackages, scriptIdsBySfx };
