// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The cartridge header reader (src/platform/roms/header.ts): where the header is and what it says.

const assert = require('assert');
const { readHeader, layoutName } = require('../../dist/platform/roms/header');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

function writeHeader(buf, offset, title, mapMode) {
    buf.write(title.padEnd(21, ' '), offset, 'ascii');
    buf[offset + 0x15] = mapMode;
    buf[offset + 0x17] = 0x0c;
    buf[offset + 0x19] = 0x01;
    buf[offset + 0x1c] = 0x34;
    buf[offset + 0x1d] = 0x12;
    buf[offset + 0x1e] = 0xcb;
    buf[offset + 0x1f] = 0xed;
    buf[offset + 0x2c] = 0x00;
    buf[offset + 0x2d] = 0x80;
}

console.log('rom header:');

test('finds a HiROM header and reads title, map mode, size and the reset vector', () => {
    const rom = Buffer.alloc(0x200000, 0x00);
    writeHeader(rom, 0xffc0, 'TEST HIROM', 0x31);
    const header = readHeader(rom);
    assert.ok(header, 'expected a header');
    assert.strictEqual(layoutName(header.kind), 'HiROM');
    assert.strictEqual(header.title, 'TEST HIROM');
    assert.strictEqual(header.mapMode, 0x31);
    assert.strictEqual(header.romSizeLog2Kb, 0x0c);
    assert.strictEqual(header.nativeVectors.reset, 0x8000);
});

test('finds a LoROM header when that candidate scores higher', () => {
    const rom = Buffer.alloc(0x100000, 0x00);
    writeHeader(rom, 0x7fc0, 'TEST LOROM', 0x20);
    const header = readHeader(rom);
    assert.ok(header, 'expected a header');
    assert.strictEqual(layoutName(header.kind), 'LoROM');
    assert.strictEqual(header.title, 'TEST LOROM');
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
