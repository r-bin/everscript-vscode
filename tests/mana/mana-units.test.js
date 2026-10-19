// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Unit tests for the Secret of Mana library (src/games/mana/decoder) on synthetic ROM images:
// every piece opcode, the metatile bit codes, the character formats and the
// Mode 1 compositor. No ROM needed. Run: node tests/mana/mana-units.test.js

const assert = require('assert');
const mana = require('../../dist/games/mana/decoder');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

const off = bus => bus & 0x3FFFFF;
function put(rom, bus, bytes) { rom.set(bytes, off(bus)); }
function put16(rom, bus, v) { put(rom, bus, [v & 0xFF, v >> 8]); }
function put24(rom, bus, v) { put(rom, bus, [v & 0xFF, (v >> 8) & 0xFF, v >> 16]); }

/** A ROM image whose piece 0 is `bytes` (header included), decoded into a fresh bank $7F. */
function decode(bytes) {
    const rom = new Uint8Array(0x400000);
    put16(rom, 0xCD0000, 0x10); put16(rom, 0xCD0002, 0x20); put16(rom, 0xCD0004, 0x1000);
    put(rom, 0xCD1000, bytes);
    const mem = new Uint8Array(0x10000).fill(0xAA);
    const size = mana.decodePiece(rom, 0, mem, 0);
    return { mem, size, row: (r, n) => Array.from(mem.subarray(r * 0x80, r * 0x80 + n)) };
}
const hdr = (w, h, stamps = 0) => [((w - 1) << 1) | stamps, (h - 1) << 1];

console.log('\nSecret of Mana — piece decoder ($00:CD93):');

test('size comes from the header, low bits set aside', () => {
    assert.deepStrictEqual(decode([...hdr(4, 1), 1, 2, 3, 4]).size, { w: 4, h: 1 });
});
test('literals, then C8-CF repeats the value two cells back', () => {
    // C9: n = 2, d = 2 -> the 1 two cells back, twice
    assert.deepStrictEqual(decode([...hdr(4, 1), 1, 2, 0xC9]).row(0, 4), [1, 2, 1, 1]);
});
test('E1-E7 copies from the row above', () => {
    const d = decode([...hdr(2, 2), 3, 4, 0xE1]);
    assert.deepStrictEqual([d.row(0, 2), d.row(1, 2)], [[3, 4], [3, 4]]);
});
test('E0 m >= $80 copies from two rows above', () => {
    const d = decode([...hdr(2, 3), 5, 6, 7, 8, 0xE0, 0x81]);
    assert.deepStrictEqual(d.row(2, 2), [5, 6]);
});
test('E8-EF repeats a pattern of distance d (overlapping copy)', () => {
    // E8 82: d = (0 << 1 | 1) + 1 = 2, n = 3
    assert.deepStrictEqual(decode([...hdr(5, 1), 1, 2, 0xE8, 0x82]).row(0, 5), [1, 2, 1, 2, 1]);
});
test('F0 m >= $80 counts down, F1-F7 count up', () => {
    assert.deepStrictEqual(decode([...hdr(4, 1), 9, 0xF0, 0x82]).row(0, 4), [9, 8, 7, 6]);
    assert.deepStrictEqual(decode([...hdr(4, 1), 1, 0xF2]).row(0, 4), [1, 2, 3, 4]);
});
test('back-references wrap to the end of the previous row', () => {
    const d = decode([...hdr(2, 2), 4, 5, 0xC0, 0xF0, 0x00]);
    assert.deepStrictEqual(d.row(1, 2), [5, 6]);
});
test('a stream stops when the last row is full, mid-opcode', () => {
    const d = decode([...hdr(2, 1), 5, 0xC7]);
    assert.deepStrictEqual(d.row(0, 3), [5, 5, 0xAA]);
});
test('F8-FF place a stamp from the stamp table after the stream', () => {
    // stamp 0: 1 wide, 2 high, data 7 8, table ends with $FF
    const d = decode([...hdr(3, 2, 1), 0x10, 7, 8, 0xFF, 0xF8, 1, 1, 1, 1, 1]);
    assert.deepStrictEqual([d.row(0, 3), d.row(1, 3)], [[7, 1, 1], [8, 1, 1]]);
});
test('piece bank: $CD below word $CD:0000, then $CE, $CF, $CC', () => {
    const rom = new Uint8Array(0x400000);
    put16(rom, 0xCD0000, 2); put16(rom, 0xCD0002, 3); put16(rom, 0xCD0004, 4);
    assert.strictEqual(mana.pieceAddress(rom, 1) >> 16, 0xCD);
    assert.strictEqual(mana.pieceAddress(rom, 2) >> 16, 0xCE);
    assert.strictEqual(mana.pieceAddress(rom, 3) >> 16, 0xCF);
    assert.strictEqual(mana.pieceAddress(rom, 4) >> 16, 0xCC);
});

console.log('\nSecret of Mana — placement ($00:CBD1):');

test('records are placed only inside their flag range; layer A size wins', () => {
    const rom = new Uint8Array(0x400000);
    put16(rom, 0xCD0000, 0x10); put16(rom, 0xCD0002, 0x20); put16(rom, 0xCD0004, 0x1000); put16(rom, 0xCD0006, 0x1010);
    put(rom, 0xCD1000, [...hdr(2, 1), 1, 2]);
    put(rom, 0xCD1010, [...hdr(3, 3), 9, 0xE0, 0x07]);
    put16(rom, 0xC85000, 0x5100); put16(rom, 0xC85002, 0x5100 + 12);
    // FE, piece 1 at (0,0) flag 4 range 1-2 (hidden at 0), piece 0 at (1,1) range 0-15
    put(rom, 0xC85100, [0xFE, 4, 0x12, 1, 0, 0, 0, 0x0F, 0, 2, 2]);
    const l = mana.assembleLayers(rom, 0);
    assert.strictEqual(l.skipped.length, 1);
    assert.deepStrictEqual(l.sizeA, { w: 2, h: 1 });
    assert.deepStrictEqual(Array.from(l.mem.subarray(0x81, 0x83)), [1, 2]);
    assert.deepStrictEqual(mana.mapSize(rom, 0), { w: 2, h: 1 });
    assert.strictEqual(mana.assembleLayers(rom, 0, () => 1).placed.length, 2);
});

console.log('\nSecret of Mana — metatile bit stream ($02:A069):');

function bitsToBytes(bits) {
    const s = bits.replace(/\s/g, '');
    const out = [];
    for (let i = 0; i < s.length; i += 8) out.push(parseInt(s.slice(i, i + 8).padEnd(8, '0'), 2));
    return out;
}
test('every code changes the running word as $02:A069 does', () => {
    const rom = new Uint8Array(0x400000);
    put24(rom, 0xCB4000, 0xCB5000);
    const b16 = v => v.toString(2).padStart(16, '0');
    put(rom, 0xCB5000, bitsToBytes([
        '11 11' + b16(0x1234), '01', '10', '00',
        '11 00 000011', '11 01 111111',
        '11 10 1101 000010', '11 10 0011 111110',
        '11 11' + b16(0x12FF), '01',
    ].join('')));
    const w = Array.from(mana.decodeMetatileSet(rom, 0).subarray(0, 10));
    assert.deepStrictEqual(w.map(x => x.toString(16)),
        ['1234', '1235', '1234', '1234', '1237', '1236', 'b238', 'ae36', '12ff', '1200']);
});

console.log('\nSecret of Mana — BG characters ($01:F413):');

test('2bpp, 3bpp and 4bpp list entries are expanded with their fill planes', () => {
    const rom = new Uint8Array(0x400000);
    put24(rom, 0xCCE270, 0xD00000); put24(rom, 0xCCE273, 0xD10000);
    put24(rom, 0xCCE276, 0xD20000); put24(rom, 0xCCE279, 0xD30000);
    put16(rom, 0xCCE27E, 0xE300); put16(rom, 0xCCE280, 0xE309);
    put(rom, 0xCCE300, [0x01, 0x40, 0, 0x02, 0xA0, 0, 0x01, 0xC0, 0]);
    for (let i = 0; i < 64; i++) { rom[0x100010 + i] = 0x11; rom[0x110030 + i] = 0x22; rom[0x120020 + i] = 0x33; }
    const v = mana.loadBgChars(rom, 0, 0);
    // char 0: 2bpp from base0 + 1*16, plane 2 = $FF (bit 14), plane 3 = $00
    assert.deepStrictEqual([v[0], v[16], v[17]], [0x11, 0xFF, 0x00]);
    // char 1: 3bpp from base1 + 2*24, plane 2 from the 3rd plane bytes, plane 3 = $FF (bit 13)
    assert.deepStrictEqual([v[32], v[48], v[49]], [0x22, 0x22, 0xFF]);
    // char 2: 4bpp copied from base2 + 1*32
    assert.deepStrictEqual([v[64], v[95]], [0x33, 0x33]);
});

console.log('\nSecret of Mana — Mode 1 compositor:');

function fakeMap(display, wordA, wordB) {
    const vram = new Uint8Array(0x10000);
    for (let r = 0; r < 8; r++) { vram[32 + r * 2] = 0xFF; vram[64 + r * 2 + 1] = 0xFF; } // char 1 = colour 1, char 2 = colour 2
    const cgram = new Uint16Array(128);
    cgram[0] = 0x0000; cgram[17] = 0x001F; cgram[18] = 0x7C00;
    const tA = new Uint16Array(768).fill(wordA), tB = new Uint16Array(768).fill(wordB);
    return { w: 1, h: 1, tableA: tA, tableB: tB, vram, cgram, display, cell: () => 0 };
}
const px = img => Array.from(img.rgba.subarray(0, 3));
test('BG2 with priority covers BG1 without; BG1 priority wins over both', () => {
    const d = { main: 0x03, sub: 0, math: 0 };
    assert.deepStrictEqual(px(mana.renderMap(fakeMap(d, 0x0401, 0x2402))), [0, 0, 255]);   // BG2 hi
    assert.deepStrictEqual(px(mana.renderMap(fakeMap(d, 0x2401, 0x2402))), [255, 0, 0]);   // BG1 hi
});
test('colour math adds the sub screen, halved, to enabled layers', () => {
    const d = { main: 0x03, sub: 0x01, math: 0x42 };      // BG2 half-added onto BG1 (the waterfall)
    const img = mana.renderMap(fakeMap(d, 0x0401, 0x2402));
    assert.deepStrictEqual(px(img), [123, 0, 123]);
});
test('isManaRom checks the internal title', () => {
    const rom = new Uint8Array(0x200000);
    rom.set(Buffer.from('Secret of MANA       '), 0xFFC0);
    assert.ok(mana.isManaRom(rom));
    rom.set(Buffer.from('SECRET OF EVERMORE   '), 0xFFC0);
    assert.ok(!mana.isManaRom(rom));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
