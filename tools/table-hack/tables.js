// The table hack (docs/table-hack.md §0): move Evermore's content tables, one at a time or together, into the
// 4th MB of a 4 MB HiROM image, rewrite the operands that read them, and wipe the old copy. No content moves.
// Everything is read from the user's ROM; this file holds only addresses and instruction patterns.
'use strict';

const MB4 = 0x400000;
const FILL = 0xFF;

const hex = (v, n = 6) => '$' + v.toString(16).toUpperCase().padStart(n, '0');
const u16 = (rom, o) => rom[o] | (rom[o + 1] << 8);
const u24 = (rom, o) => rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
const put24 = (img, o, v) => { img[o] = v & 0xFF; img[o + 1] = (v >> 8) & 0xFF; img[o + 2] = (v >> 16) & 0xFF; };

const SCRIPT_BANK = 0x128000;                 // $92:8000, the script bank header
/** File offset of a packed script pointer (src/script/addressing.ts). */
const unpackScript = v => (0x128000 + (v & 0x7FFF) + ((v & 0xFF8000) << 1)) & 0xFFFFFF;

/**
 * A reader operand: the instruction at file offset `at` must have opcode `op` and the 24-bit operand `old`;
 * the hack writes `(newBus + delta)` there. `delta` keeps an operand that addresses entry+1 or base-offset.
 */
function operand(at, op, old) { return { at, op, old }; }

// Each table: where it is (file offsets), how long it is in this ROM, where it goes, and its readers. `bus` says
// which bank form the readers use: the hack keeps it ($8x-$Bx stays a FastROM mirror, upper half only).
const TABLES = {
    map_table: {
        what: 'room id -> room blob (24-bit pointer + pad)',
        start: 0x1FFDE7, entry: 4, count: () => 127,
        to: 0x318000,
        readers: [operand(0x108F69, 0xBF, 0x9FFDE7), operand(0x108F6F, 0xBF, 0x9FFDE8)],
    },
    room_enter_scripts: {
        what: 'room id -> enter script (packed pointer + 2 bytes)',
        start: 0x12801B, entry: 5, count: () => 127,
        // the last entry's 2 unread bytes overlap the script pointer table: wipe only up to that table
        wipeEnd: rom => SCRIPT_BANK + u16(rom, SCRIPT_BANK),
        to: 0x319000,
        readers: [operand(0x0CCECC, 0xBF, 0x92801B), operand(0x0CCED2, 0xBF, 0x92801C)],
    },
    string_keys: {
        what: 'string index -> string (packed pointer, bit 23 = compressed)',
        start: 0x11D000, entry: 3, count: () => 3002,
        to: 0x31A000,
        // `lda #$0091 : sta $28 : ldy #$D000` then `lda [$26],y`: bank and offset are two immediates
        immediates: [0x0CCCF7, 0x0CCD35],
        // WRAM that holds the table's own address: $28 is the bank of that pointer ($91 -> $B1), seen at frame 5140
        // of the attract loop and overwritten the next frame. The proof leaves it out of the WRAM checksum.
        scratch: [0x7E0028],
    },
    script_pointers: {
        what: 'trigger / NPC / global script id (byte offset) -> script (packed pointer)',
        // $928000 + word[$928000]; readers add the header word to X, so the new base operand is new - word
        start: rom => SCRIPT_BANK + u16(rom, SCRIPT_BANK), entry: 3,
        count: rom => scriptTableCount(rom),
        to: 0x31D000,
        headerBias: true,
        readers: [operand(0x0CCE63, 0xBF, 0x928000), operand(0x0CCE69, 0xBF, 0x928002),
            operand(0x0CD3B5, 0xBF, 0x928000), operand(0x0CD3BB, 0xBF, 0x928002)],
    },
};

/** Entries up to the first byte any entry points at (the first script follows the table directly). */
function scriptTableCount(rom) {
    const start = SCRIPT_BANK + u16(rom, SCRIPT_BANK);
    let lowest = Infinity, n = 0;
    while (start + n * 3 < Math.min(lowest, SCRIPT_BANK + 0x8000)) {
        const t = unpackScript(u24(rom, start + n * 3));
        if (t > start) lowest = Math.min(lowest, t);
        n++;
    }
    return n;
}

const value = (f, rom) => (typeof f === 'function' ? f(rom) : f);
/** The bus address the readers should use for file offset `file` (upper half, FastROM mirror bank). */
const mirrorBus = file => 0x800000 | file;

/**
 * Build the 4 MB image with `names` moved. `extra` = { string_keys: [3-byte values to append], … }.
 * The 4th MB starts as what the bundled snes9x core shows past a 3 MB ROM (offset % size), so an image with
 * nothing moved behaves exactly like the original in that core, $80:D113's read past the ROM included
 * (knowledge/rom/80d113.md).
 * @returns {{ image: Uint8Array, moves: object[] }}
 */
function build(source, names = [], extra = {}) {
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    if (rom.length !== 0x300000) throw new Error(`expected the clean 3 MB ROM, got ${rom.length} bytes`);
    const img = new Uint8Array(MB4);
    img.set(rom);
    for (let o = rom.length; o < MB4; o++) img[o] = rom[o % rom.length];
    const moves = [];
    for (const name of names) {
        const t = TABLES[name];
        if (!t) throw new Error(`unknown table ${name} (known: ${Object.keys(TABLES).join(', ')})`);
        const start = value(t.start, rom), count = t.count(rom), len = count * t.entry;
        const added = extra[name] || [];
        const total = len + added.length * t.entry;
        if ((t.to >> 15) !== ((t.to + total - 1) >> 15)) throw new Error(`${name} would cross a bank half`);
        img.set(rom.subarray(start, start + len), t.to);
        added.forEach((v, i) => put24(img, t.to + len + i * t.entry, v));
        const wipeEnd = t.wipeEnd ? t.wipeEnd(rom) : start + len;
        img.fill(FILL, start, wipeEnd);
        const rewritten = [];
        for (const r of t.readers || []) {
            if (img[r.at] !== r.op || u24(img, r.at + 1) !== r.old) throw new Error(`${name}: ${hex(r.at)} is not op ${hex(r.op, 2)} ${hex(r.old)}`);
            const delta = (r.old & 0xFFFF) - (t.headerBias ? 0 : (0x800000 | start) & 0xFFFF) - (t.headerBias ? 0x8000 : 0);
            const bias = t.headerBias ? u16(rom, SCRIPT_BANK) : 0;
            const v = mirrorBus(t.to) - bias + delta;
            put24(img, r.at + 1, v);
            rewritten.push(`${hex(r.at)}: ${hex(r.old)} -> ${hex(v)}`);
        }
        for (const at of t.immediates || []) {
            const want = [0xA9, 0x91, 0x00, 0x85, 0x28, 0xA0, 0x00, 0xD0];
            if (want.some((b, i) => img[at + i] !== b)) throw new Error(`${name}: ${hex(at)} is not the key-table reader pattern`);
            const bus = mirrorBus(t.to);
            img[at + 1] = bus >> 16; img[at + 6] = bus & 0xFF; img[at + 7] = (bus >> 8) & 0xFF;
            rewritten.push(`${hex(at)}: #$0091/#$D000 -> #$00${(bus >> 16).toString(16).toUpperCase()}/#$${(bus & 0xFFFF).toString(16).toUpperCase()}`);
        }
        moves.push({ name, what: t.what, from: start, count, added: added.length, bytes: total, to: t.to, bus: mirrorBus(t.to), wiped: [start, wipeEnd], rewritten });
    }
    finish(img);
    return { image: img, moves };
}

/** Header says 4 MB; checksum and complement recomputed over the whole image. */
function finish(img) {
    img[0xFFD7] = 0x0C;
    img[0xFFDC] = 0xFF; img[0xFFDD] = 0xFF; img[0xFFDE] = 0; img[0xFFDF] = 0;
    let sum = 0;
    for (let i = 0; i < img.length; i++) sum += img[i];
    const cs = sum & 0xFFFF;
    img[0xFFDE] = cs & 0xFF; img[0xFFDF] = cs >> 8; img[0xFFDC] = (cs ^ 0xFFFF) & 0xFF; img[0xFFDD] = (cs ^ 0xFFFF) >> 8;
}

module.exports = { TABLES, build, finish, scriptTableCount, unpackScript, hex, MB4 };
