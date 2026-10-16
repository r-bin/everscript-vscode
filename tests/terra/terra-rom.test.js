'use strict';
// Terranigma library tests against synthetic buffers and the real ROM (if present).
// Run: node tests/terra/terra-rom.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { identifyRom } = require('../../dist/platform');
const terra = require('../../dist/games/terra');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

console.log('\nTerranigma — Unit tests (synthetic):');

test('isTerraRom detects Terranigma titles and rejects others', () => {
    const rom = new Uint8Array(0x100000);
    // Put TERRANIGMA P at HiROM header location 0xFFC0
    rom.set(Buffer.from('TERRANIGMA P         '), 0xFFC0);
    rom[0xFFD5] = 0x31; // HiROM FastROM
    rom[0xFFDC] = 0x00; rom[0xFFDD] = 0x00; // complement
    rom[0xFFDE] = 0xFF; rom[0xFFDF] = 0xFF; // checksum (valid pair)
    assert.strictEqual(terra.isTerraRom(rom), true);

    // Tenchi Souzou title
    rom.set(Buffer.from('TENCHI-JPN           '), 0xFFC0);
    assert.strictEqual(terra.isTerraRom(rom), true);

    // Secret of Evermore title
    rom.set(Buffer.from('SECRET OF EVERMORE   '), 0xFFC0);
    assert.strictEqual(terra.isTerraRom(rom), false);

    // Secret of Mana title
    rom.set(Buffer.from('Secret of MANA       '), 0xFFC0);
    assert.strictEqual(terra.isTerraRom(rom), false);
});

test('room table constants and boundary checks', () => {
    assert.strictEqual(terra.TERRA_ROOM_COUNT, 1104);
    assert.strictEqual(terra.TERRA_BASE_ROOM_TABLE_OFFSET, 0x06959c);
    assert.strictEqual(terra.TERRA_BASE_TABLE_B_OFFSET, 0x06a28c);
    assert.strictEqual(terra.TERRA_UNUSED_SLOT_POINTER, 0x000002);

    const smallRom = new Uint8Array(100);
    assert.strictEqual(terra.readRoomBusAddress(smallRom, 0), null);
    assert.strictEqual(terra.readRoomBusAddress(smallRom, -1), null);
    assert.strictEqual(terra.readRoomBusAddress(smallRom, 2000), null);
    assert.strictEqual(terra.readRoomHeaderBytes(smallRom, 0), null);
    assert.strictEqual(terra.decodeRoomHeader(smallRom, 0), null);
});

test('decodeRoomHeader decodes header bitstream opcodes and SPC tracks', () => {
    const rom = new Uint8Array(0x200000);
    // Put pointer for room 0x000A at 0x06959c + 0x000A * 3 pointing to bus $9A:8350 -> file 0x1A8350
    const tableOffset = terra.TERRA_BASE_ROOM_TABLE_OFFSET;
    const ptrOffset = tableOffset + 0x000A * 3;
    rom[ptrOffset] = 0x50;
    rom[ptrOffset + 1] = 0x83;
    rom[ptrOffset + 2] = 0x9A;

    // Put room header at 0x1A8350: [0x02, 0x14, 0x10, 0x01, 0x02, 0x00]
    const headerOffset = 0x1A8350;
    rom[headerOffset] = 0x02; rom[headerOffset + 1] = 0x14; // SPC track 0x14
    rom[headerOffset + 2] = 0x10; rom[headerOffset + 3] = 0x01; rom[headerOffset + 4] = 0x02; // Layers
    rom[headerOffset + 5] = 0x00; // End

    const header = terra.decodeRoomHeader(rom, 0x000A);
    assert.ok(header);
    assert.strictEqual(header.roomId, 0x000A);
    assert.strictEqual(header.busAddress, 0x9A8350);
    assert.strictEqual(header.fileOffset, 0x1A8350);
    assert.strictEqual(header.spcTrack, 0x14);
    assert.deepStrictEqual(header.rawBytes, [0x02, 0x14, 0x10, 0x01, 0x02, 0x00]);
    assert.strictEqual(header.opcodes.length, 3);
    assert.strictEqual(header.opcodes[0].opcode, 0x02);
    assert.strictEqual(header.opcodes[1].opcode, 0x10);
    assert.strictEqual(header.opcodes[2].opcode, 0x00);
});

// Check if a Terranigma ROM is available from the ROM library
const ROM_PATH = require('../../dist/games').romPath('terra') || '';

let romBytes = null;
if (ROM_PATH) {
    try {
        romBytes = new Uint8Array(fs.readFileSync(ROM_PATH));
    } catch (_) {
        console.log('\nTerranigma ROM at ' + ROM_PATH + ' cannot be opened in current sandbox — skipping ROM checks.');
    }
}

if (!romBytes) {
    console.log('\nTerranigma ROM tests skipped (add ROM via npm run roms -- add <path>).');
} else {
    console.log('\nTerranigma — ROM tests (' + ROM_PATH + '):');

    test('ROM is identified as Terranigma Europe (known base variant)', () => {
        const id = identifyRom(romBytes);
        assert.strictEqual(id.game, 'terra');
        assert.strictEqual(id.variant, 'eu');
        assert.strictEqual(id.match, 'known');
        assert.strictEqual(id.title, 'TERRANIGMA P');
        assert.strictEqual(id.pal, true);
        assert.strictEqual(id.size, 4194304);
    });

    test('cartridge header is valid HiROM FastROM PAL', () => {
        const h = terra.readTerraHeader(romBytes);
        assert.ok(h);
        assert.strictEqual(h.title, 'TERRANIGMA P');
        assert.strictEqual(h.kind, 'hirom');
        assert.strictEqual(h.mapMode, 0x31);
        assert.strictEqual(h.region, 0x02);
        assert.strictEqual(h.checksumPairOk, true);
    });

    test('Table A room pointers resolve correctly for base ROM', () => {
        // Room 0x000A: Crysta
        const crystaBus = terra.readRoomBusAddress(romBytes, 0x000A);
        assert.strictEqual(crystaBus, 0x9A8350);
        assert.strictEqual(terra.readRoomFileOffset(romBytes, 0x000A), 0x1A8350);
        assert.strictEqual(terra.isRoomSlotUsed(romBytes, 0x000A), true);

        // Room 0x0004: Savescreen
        const saveBus = terra.readRoomBusAddress(romBytes, 0x0004);
        assert.strictEqual(saveBus, 0xB58002);
        assert.strictEqual(terra.readRoomFileOffset(romBytes, 0x0004), 0x358002);
        assert.strictEqual(terra.isRoomSlotUsed(romBytes, 0x0004), true);

        // Unused slots (0x0008, 0x0009)
        assert.strictEqual(terra.readRoomBusAddress(romBytes, 0x0008), 0x000002);
        assert.strictEqual(terra.readRoomFileOffset(romBytes, 0x0008), null);
        assert.strictEqual(terra.isRoomSlotUsed(romBytes, 0x0008), false);

        assert.strictEqual(terra.readRoomBusAddress(romBytes, 0x0009), 0x000002);
        assert.strictEqual(terra.readRoomFileOffset(romBytes, 0x0009), null);
        assert.strictEqual(terra.isRoomSlotUsed(romBytes, 0x0009), false);
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
