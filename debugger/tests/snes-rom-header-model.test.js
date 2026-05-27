'use strict';

const assert = require('assert');
const { parseSnesRomHeader } = require('../emulator/snes-rom-header-model');

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
    buf[offset + 0x16] = 0x02;
    buf[offset + 0x17] = 0x0c;
    buf[offset + 0x18] = 0x03;
    buf[offset + 0x19] = 0x01;
    buf[offset + 0x1a] = 0x33;
    buf[offset + 0x1b] = 0x00;
    buf[offset + 0x1c] = 0x34;
    buf[offset + 0x1d] = 0x12;
    buf[offset + 0x1e] = 0xcb;
    buf[offset + 0x1f] = 0xed;
    buf[offset + 0x2c] = 0x00;
    buf[offset + 0x2d] = 0x80;
}

console.log('snes-rom-header-model:');

test('detects a HiROM header and decodes basic cartridge metadata', () => {
    const rom = Buffer.alloc(0x200000, 0x00);
    writeHeader(rom, 0xffc0, 'SECRET OF EVERMORE', 0x31);
    const header = parseSnesRomHeader(rom);
    assert.ok(header, 'expected a parsed header');
    assert.strictEqual(header.layout, 'HiROM');
    assert.strictEqual(header.title, 'SECRET OF EVERMORE');
    assert.strictEqual(header.mapMode.description, 'FastROM HiROM');
    assert.strictEqual(header.romSizeBytes, 0x400000);
    assert.strictEqual(header.ramSizeBytes, 0x2000);
    assert.strictEqual(header.nativeVectors.reset, 0x8000);
});

test('detects a LoROM header when that candidate scores higher', () => {
    const rom = Buffer.alloc(0x100000, 0x00);
    writeHeader(rom, 0x7fc0, 'TEST LOROM', 0x20);
    const header = parseSnesRomHeader(rom);
    assert.ok(header, 'expected a parsed header');
    assert.strictEqual(header.layout, 'LoROM');
    assert.strictEqual(header.mapMode.description, 'LoROM');
    assert.strictEqual(header.title, 'TEST LOROM');
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);