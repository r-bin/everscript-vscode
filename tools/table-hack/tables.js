// The table hack (docs/table-hack.md §0): move Evermore's content tables, one at a time or together, into the
// 4th MB of a 4 MB HiROM image, rewrite the operands that read them, and wipe the old copy. No content moves.
// Everything is read from the user's ROM; this file holds only addresses and instruction patterns.
'use strict';

const MB4 = 0x400000;
const FILL = 0xFF;

const hex = (v, n = 6) => '$' + v.toString(16).toUpperCase().padStart(n, '0');
const { fileU16: u16, fileU24: u24 } = require('../../dist/platform');
const put24 = (img, o, v) => { img[o] = v & 0xFF; img[o + 1] = (v >> 8) & 0xFF; img[o + 2] = (v >> 16) & 0xFF; };

const SCRIPT_BANK = 0x128000;                 // $92:8000, the script bank header
/** File offset of a packed script pointer (docs/game-research/script-vm/README.md, "Script addresses"). */
const unpackScript = v => (0x128000 + (v & 0x7FFF) + ((v & 0xFF8000) << 1)) & 0xFFFFFF;

/**
 * A reader operand: the instruction at file offset `at` must have opcode `op` and the 24-bit operand `old`;
 * the hack writes `(newBus + delta)` there. `delta` keeps an operand that addresses entry+1 or base-offset.
 */
function operand(at, op, old) { return { at, op, old }; }

/** A patch site: the bytes at `at` must be `expect`; the hack writes `write(bus)` (bus = the table's new address). */
function site(at, expect, write) { return { at, expect, write }; }

// The character table is read as `<op>.l $8E00xx,X` (or `$CE00xx,X`) with X = a character's 16-bit address: the
// field offset is the operand, the record is X. These are the long and long-indexed opcodes that take such an
// operand, and the file banks the game's code lives in ($80, $8C-$91); a hit elsewhere is data that looks alike.
const LONG_OPS = new Set([0xAF, 0x8F, 0x6F, 0xEF, 0xCF, 0x2F, 0x0F, 0x4F, 0xBF, 0x9F, 0x7F, 0xFF, 0xDF, 0x3F, 0x1F, 0x5F]);
const CODE_BANKS = new Set([0x00, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11]);
const RECORD = 74;

/** Every `$8E00xx` / `$CE00xx` operand with xx inside a record, split into code-bank hits and the rest. */
function characterOperands(rom) {
    const code = [], elsewhere = [];
    for (let o = 0; o + 4 <= rom.length; o++) {
        if (!LONG_OPS.has(rom[o]) || rom[o + 2] !== 0x00 || rom[o + 1] >= RECORD || (rom[o + 3] !== 0x8E && rom[o + 3] !== 0xCE)) continue;
        (CODE_BANKS.has(o >> 16) ? code : elsewhere).push(o);
    }
    return { code, elsewhere };
}

/** Highest tile family any room loads, + 1 (src/games/evermore/maps decodes every room). */
function familyCount(rom) {
    const maps = require('../../src/games/evermore/maps');
    let max = 0;
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        try { for (const f of maps.decodeRoom(rom, id).tileFamilies) max = Math.max(max, f); } catch (_) { /* not a room */ }
    }
    return max + 1;
}

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
        sites: [0x0CCCF7, 0x0CCD35].map(at => site(at, [0xA9, 0x91, 0x00, 0x85, 0x28, 0xA0, 0x00, 0xD0],
            bus => [0xA9, bus >> 16, 0x00, 0x85, 0x28, 0xA0, bus & 0xFF, (bus >> 8) & 0xFF])),
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
    enemy_index: {
        what: 'ENEMY id (spawn opcodes 0x3C/0xBA/0xA2/0xC2) -> character record address (word, bank of the records)',
        // `lda.l $8EB55A,x` with X = enemy*2 in all four spawn handlers ($8C:DC9A/DCC3/DCD9/DCEC). Entries 0/1 are
        // the Boy and the Dog, whose records live in WRAM ($0A26/$0A70). 0xBA/0xC2 take a byte id: 256 at most.
        start: 0x0EB55A, entry: 2, count: () => 143,
        to: 0x388000, limit: 256,
        readers: [operand(0x0CDCA1, 0xBF, 0x8EB55A), operand(0x0CDCCC, 0xBF, 0x8EB55A),
            operand(0x0CDCE2, 0xBF, 0x8EB55A), operand(0x0CDCF3, 0xBF, 0x8EB55A)],
    },
    characters: {
        what: 'character records, 74 bytes (docs/script-format/character_table.md), addressed by their 16-bit address',
        // Records keep their 16-bit addresses (enemy index values, WRAM entity fields), so they move to the same
        // offset in another bank and every reader changes only its bank byte: $8E -> $B8 (a $80-$BF bank, so
        // X = $0A26/$0A70 still reaches the Boy's and Dog's records in WRAM) and $CE -> $F8. New records follow the
        // vanilla ones up to the end of the bank: 113 more.
        start: 0x0EB678, entry: RECORD, count: () => 141,
        to: 0x38B678, sameOffset: true,
        rebank: rom => characterOperands(rom),
        // $8F:803C copies the Boy's and Dog's templates (records 0-1, $94 bytes) into WRAM $0A26 with
        // `mvn $8E,$8E` (opcode, dest bank, source bank): only the source bank moves.
        sites: [site(0x0F8046, [0x54, 0x8E, 0x8E], bus => [0x54, 0x8E, bus >> 16])],
    },
    animate_ids: {
        what: 'global animate() id -> animation record (word: a 16-bit offset in bank $C4)',
        // `lda.l $C43C92,x` at $8C:E13C is the only reader (scan: the other 100 hits are data). Moving it frees
        // $C4:3C92-$C4:3E39, right before the record table, for new animation records: record ids are 16-bit
        // offsets into bank $C4, so new records have to be there (ANIMATION_RECORD_POOL). Ids >= $8000 mean the
        // character's own field, so the table can grow to 2048 ids in its 4 KB.
        start: 0x043C92, entry: 2, count: () => 212,
        to: 0x31F000, limit: 2048,
        readers: [operand(0x0CE13C, 0xBF, 0xC43C92)],
    },
    sprite_blocks_16: {
        what: '16x16 sprite block id -> pixels (3 bytes: 23-bit offset from $D90000, bit 23 = compressed)',
        // `lda.l $EC0000,x` / `$EC0001,x` at $80:9742, $80:9751, $80:A2E6 (all CDL code; no other operand, no
        // `lda #$EC`). The table is full in vanilla; in the lower half of $F8 it has room for 10922 ids.
        start: 0x2C0000, entry: 3, count: () => 4854,
        to: 0x380000, full: true, limit: 10922,
        readers: [operand(0x009742, 0xBF, 0xEC0001), operand(0x009751, 0xBF, 0xEC0000), operand(0x00A2E6, 0xBF, 0xEC0000)],
    },
    sprite_blocks_8: {
        what: '8x8 sprite block id -> pixels (3 bytes: 23-bit offset from $D10000, bit 23 = compressed)',
        // `lda.l $D80000,x` / `$D80001,x` at $80:A4FC, $80:A50B, $80:A800 (all CDL code). Lower half of $F9.
        start: 0x180000, entry: 3, count: () => 6265,
        to: 0x390000, full: true, limit: 10922,
        readers: [operand(0x00A4FC, 0xBF, 0xD80001), operand(0x00A50B, 0xBF, 0xD80000), operand(0x00A800, 0xBF, 0xD80000)],
    },
    map_palettes: {
        what: 'background palette families, 32 bytes each, $9C:C322 + 32*family (src/games/evermore/maps tileFamilies)',
        // `adc #$C322` and `lda #$9C` in the family loader ($90:D05C) are the only readers; moved to $B9:8000 the
        // 16-bit source address has room for 1024 families (vanilla: 365; in place at most 486).
        start: 0x1CC322, entry: 32, count: rom => familyCount(rom),
        to: 0x398000, limit: 1024,
        sites: [site(0x10D065, [0x69, 0x22, 0xC3], bus => [0x69, bus & 0xFF, (bus >> 8) & 0xFF]),
            site(0x10D079, [0xA9, 0x9C], bus => [0xA9, bus >> 16])],
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
/** A table in a lower bank half is ROM only through the $C0-$FF form. */
const busOf = t => (t.full ? 0xC00000 | t.to : mirrorBus(t.to));

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
        if (name === 'sprite_palettes') { moves.push(require('./hooks').spritePalettes(img, extra[name])); continue; }
        const t = TABLES[name];
        if (!t) throw new Error(`unknown table ${name} (known: ${[...Object.keys(TABLES), 'sprite_palettes'].join(', ')})`);
        const start = value(t.start, rom), count = t.count(rom), len = count * t.entry;
        const added = extra[name] || [];
        const total = len + added.length * t.entry;
        if (t.limit && count + added.length > t.limit) throw new Error(`${name}: ${count + added.length} entries, the engine takes ${t.limit}`);
        if (t.sameOffset && (t.to & 0xFFFF) !== (start & 0xFFFF)) throw new Error(`${name} must keep its 16-bit offset`);
        if ((t.to >> 15) !== ((t.to + total - 1) >> 15)) throw new Error(`${name} would cross a bank half`);
        img.set(rom.subarray(start, start + len), t.to);
        added.forEach((v, i) => {
            const at = t.to + len + i * t.entry;
            if (typeof v === 'number') for (let k = 0; k < t.entry; k++) img[at + k] = (v >> (8 * k)) & 0xFF;
            else { if (v.length !== t.entry) throw new Error(`${name}: an entry is ${t.entry} bytes`); img.set(v, at); }
        });
        const wipeEnd = t.wipeEnd ? t.wipeEnd(rom) : start + len;
        img.fill(FILL, start, wipeEnd);
        const rewritten = [], left = [];
        for (const r of t.readers || []) {
            if (img[r.at] !== r.op || u24(img, r.at + 1) !== r.old) throw new Error(`${name}: ${hex(r.at)} is not op ${hex(r.op, 2)} ${hex(r.old)}`);
            const delta = (r.old & 0xFFFF) - (t.headerBias ? 0 : (0x800000 | start) & 0xFFFF) - (t.headerBias ? 0x8000 : 0);
            const bias = t.headerBias ? u16(rom, SCRIPT_BANK) : 0;
            const v = busOf(t) - bias + delta;
            put24(img, r.at + 1, v);
            rewritten.push(`${hex(r.at)}: ${hex(r.old)} -> ${hex(v)}`);
        }
        for (const p of t.sites || []) {
            if (p.expect.some((b, i) => img[p.at + i] !== b)) throw new Error(`${name}: ${hex(p.at)} is not ${p.expect.map(b => hex(b, 2)).join(' ')}`);
            const bytes = p.write(busOf(t));
            img.set(bytes, p.at);
            rewritten.push(`${hex(p.at)}: ${p.expect.map(b => b.toString(16).padStart(2, '0')).join(' ')} -> ${bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        }
        if (t.rebank) {
            const { code, elsewhere } = t.rebank(rom);
            const bank = t.to >> 16;
            for (const o of code) img[o + 3] = rom[o + 3] === 0x8E ? 0x80 | bank : 0xC0 | bank;
            rewritten.push(`${code.length} operands $8E00xx/$CE00xx -> $${(0x80 | bank).toString(16).toUpperCase()}00xx/$${(0xC0 | bank).toString(16).toUpperCase()}00xx (code banks)`);
            left.push(...elsewhere.map(o => hex(o)));
        }
        moves.push({ name, what: t.what, from: start, count, added: added.length, limit: t.limit, bytes: total, to: t.to, bus: busOf(t), wiped: [start, wipeEnd], rewritten, left });
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

/** Where new animation records go once animate_ids has moved: bank $C4, before the record table. */
const ANIMATION_RECORD_POOL = { start: 0x043C92, end: 0x043E3A };

module.exports = { ANIMATION_RECORD_POOL, TABLES, build, finish, scriptTableCount, characterOperands, familyCount, unpackScript, hex, MB4 };
