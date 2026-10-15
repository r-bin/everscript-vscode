'use strict';

/**
 * tools/exhirom/convert.js on a synthetic HiROM image (no game bytes): header in both places, checksum, the
 * bank-$00 entry code copied to the new half, the 4th-megabyte mirror modes, and refusals for vector code that a
 * plain copy cannot move. The real-ROM proof is `node tools/exhirom/prove.js` (docs/architecture/exhirom-port.md).
 */

const assert = require('assert');
const { convert, bankZeroEntry, hardwareMirror, secondHalfUsed, HALF, OUT_SIZE } = require('../../tools/exhirom/convert');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}

const MB = 0x100000;
const RESET = [0xA9, 0x8F, 0x8D, 0x00, 0x21, 0x18, 0xFB, 0xC2, 0x30, 0x5C, 0x2D, 0x80, 0x80]; // LDA #; STA $2100; CLC; XCE; REP #$30; JML $80:802D
const NMI = [0x5C, 0x3E, 0x82, 0x80];                                                       // JML $80:823E

function makeRom({ reset = RESET, size = 3 * MB } = {}) {
    const rom = new Uint8Array(size);
    for (let i = 0; i < size; i++) rom[i] = (i * 7 + (i >> 16)) & 0xFF;
    rom.set([...'SYNTHETIC HIROM      '].map(c => c.charCodeAt(0)), 0xFFC0);
    rom[0xFFD5] = 0x31; rom[0xFFD7] = 0x0C;
    rom.fill(0, 0xFFE0, 0x10000);
    const vec = (slot, addr) => { rom[slot] = addr & 0xFF; rom[slot + 1] = addr >> 8; };
    vec(0xFFE4, 0x885E); vec(0xFFE6, 0x885F); vec(0xFFEA, 0x823A); vec(0xFFEE, 0x823A);
    vec(0xFFFA, 0x823A); vec(0xFFFC, 0x8020); vec(0xFFFE, 0x823A);
    rom.set(reset, 0x8020); rom.set(NMI, 0x823A); rom[0x885E] = 0xDB; rom[0x885F] = 0xDB;
    return rom;
}

test('the original stays byte-identical except the header fields', () => {
    const rom = makeRom();
    const { image, report } = convert(rom);
    assert.strictEqual(image.length, OUT_SIZE);
    assert.deepStrictEqual(report.changedInSource, [0xFFD5, 0xFFD7, 0xFFDC, 0xFFDD, 0xFFDE, 0xFFDF]);
    for (const base of [0, HALF]) {
        assert.strictEqual(image[base + 0xFFD5], 0x35, 'map mode ExHiROM + FastROM');
        assert.strictEqual(image[base + 0xFFD7], 0x0D, 'size 8 MB');
    }
    assert.deepStrictEqual(image.subarray(HALF + 0xFFB0, HALF + 0x10000), image.subarray(0xFFB0, 0x10000), 'header and vectors repeated');
});

test('both checksum pairs cover the whole 8 MB image', () => {
    const { image } = convert(makeRom());
    let sum = 0;
    for (const b of image) sum += b;
    for (const base of [0, HALF]) {
        const cs = image[base + 0xFFDE] | (image[base + 0xFFDF] << 8), cc = image[base + 0xFFDC] | (image[base + 0xFFDD] << 8);
        assert.strictEqual(cs, sum & 0xFFFF);
        assert.strictEqual(cs ^ cc, 0xFFFF);
    }
});

test('every vector target\'s bank-$00 code is copied up to its exit', () => {
    const rom = makeRom();
    const { image, report } = convert(rom, { fill: 0xDB, upper: 'fill' });
    const byStart = Object.fromEntries(report.entries.map(e => [e.start, e]));
    assert.strictEqual(byStart[0x8020].length, 13);
    assert.strictEqual(byStart[0x8020].exit, 'JML $80:802D');
    assert.deepStrictEqual(byStart[0x823A].vectors.sort(), ['IRQ', 'IRQ/BRK (emu)', 'NMI', 'NMI (emu)']);
    assert.strictEqual(byStart[0x885E].exit, 'STP');
    assert.deepStrictEqual([...image.subarray(HALF + 0x8020, HALF + 0x8020 + 13)], RESET);
    assert.deepStrictEqual([...image.subarray(HALF + 0x823A, HALF + 0x823E)], NMI);
    const used = secondHalfUsed(report);
    for (let i = HALF; i < OUT_SIZE; i += 0x777) {
        if (!used.some(([a, b]) => i >= a && i < b)) assert.strictEqual(image[i], 0xDB, `0x${i.toString(16)} is trap fill`);
    }
});

test('the 4th megabyte repeats the cartridge mirror, the snes9x2005 wrap, or fill', () => {
    const rom = makeRom();
    assert.strictEqual(hardwareMirror(0x30E653, 3 * MB), 0x20E653, '3 MB = 2 MB + 1 MB: 0x300000+ shows 0x200000+');
    assert.strictEqual(hardwareMirror(0x3FFFFF, 3 * MB), 0x2FFFFF);
    assert.strictEqual(hardwareMirror(0x280000, 2.5 * MB), 0x200000, '2.5 MB: the 512 KB chip repeats');
    assert.strictEqual(hardwareMirror(0x1234, 3 * MB), 0x1234, 'inside the ROM nothing moves');
    assert.strictEqual(convert(rom).image[0x30E653], rom[0x20E653]);
    assert.strictEqual(convert(rom, { upper: 'snes9x2005' }).image[0x30E653], rom[0x00E653]);
    assert.strictEqual(convert(rom, { upper: 'fill', fill: 0xDB }).image[0x30E653], 0xDB);
});

test('vector code that cannot simply be copied is refused', () => {
    assert.throws(() => convert(makeRom({ reset: [0x4B, 0xAB, 0x5C, 0x2D, 0x80, 0x80] })), /PHK.*hand-written stub/);
    assert.throws(() => convert(makeRom({ reset: [0xAD, 0x00, 0x90, 0x5C, 0x2D, 0x80, 0x80] })), /LDA.*hand-written stub/, 'a read through bank $00');
    assert.throws(() => convert(makeRom({ reset: [0x8D, 0x00, 0x90, 0x5C, 0x2D, 0x80, 0x80] })), /STA.*hand-written stub/, 'a store outside WRAM/I/O');
    assert.throws(() => convert(makeRom({ reset: [0x5C, 0x2D, 0x80, 0x00] })), /moves under ExHiROM/, 'a jump that stays below bank $80');
    assert.throws(() => convert(makeRom({ size: 5 * MB })), /64 KB-4 MB/);
    const lorom = makeRom(); lorom[0xFFD5] = 0x30;
    assert.throws(() => convert(lorom), /not HiROM/);
    assert.throws(() => bankZeroEntry(makeRom(), 0x8020, false), /unknown width/, 'an interrupt stub cannot know the width of LDA #');
    assert.strictEqual(bankZeroEntry(makeRom(), 0x8020, true).length, 13);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
