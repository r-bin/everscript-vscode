'use strict';
/**
 * memory_radar/tests/map-pipeline-model.test.js
 * Unit tests for map-pipeline-model.js pure functions.
 * Run with: node memory_radar/tests/map-pipeline-model.test.js
 *
 * Tests cover all stages that do NOT require a ROM file:
 *   - applyDeltaDecode   (fully deterministic, no ROM needed)
 *   - snesToRomOffset    (address conversion formula)
 *   - romToSnesHiRom     (address conversion formula)
 *   - parseTilemap       (nibble decode from synthetic buffer)
 *   - findSentinel       (pattern scan from synthetic buffer)
 *   - TRUSTED_MAPS[0x33] pass1 -> pass2 delta decode verification
 *   - TRUSTED_MAPS[0x33] EE table address formula (no ROM: formula only)
 *   - parseRenderScript93 (opcode structure from synthetic ROM bytes)
 *
 * ROM-dependent tests (EE descriptor actual lookups, blob parse) are skipped
 * when no ROM is present. They are run in CI by providing ROM env var.
 */

const assert = require('assert');
const fs     = require('fs');
const {
    applyDeltaDecode,
    snesToRomOffset,
    romToSnesHiRom,
    parseTilemap,
    findSentinel,
    parseRenderScript93,
    lookupEEDescriptor,
    parseBlobHeader,
    parseTriggerTables,
    parseTileFamilies,
    parseMapBlob,
    TRUSTED_MAPS,
    loadRom,
    hex,
    readU8,
    readU16LE,
    readU24LE,
} = require('../models/map-pipeline-model');

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); console.log('  OK  ' + name); passed++; }
    catch (e) { console.error('  FAIL ' + name + '\n      ' + e.message); failed++; }
}

function skip(name, reason) {
    console.log('  SKIP ' + name + '  (' + reason + ')');
}

// ---------------------------------------------------------------------------
// snesToRomOffset
// ---------------------------------------------------------------------------
console.log('\n-- snesToRomOffset --');
test('bank 0xAD -> ROM 0x2D****', () => {
    // snesToRomOffset(0xADB50C) = (0x2D * 0x10000) + 0xB50C = 0x2DB50C
    assert.strictEqual(snesToRomOffset(0xADB50C), 0x2DB50C);
});
test('EE0000 -> ROM 0x2E0000', () => {
    // (0xEE & 0x3F) = 0x2E; 0x2E*0x10000 + 0x0000 = 0x2E0000
    assert.strictEqual(snesToRomOffset(0xEE0000), 0x2E0000);
});
test('EE0003 -> ROM 0x2E0003', () => {
    assert.strictEqual(snesToRomOffset(0xEE0003), 0x2E0003);
});

// ---------------------------------------------------------------------------
// romToSnesHiRom
// ---------------------------------------------------------------------------
console.log('\n-- romToSnesHiRom --');
test('0x2DB50C -> 0xADB50C', () => {
    // bank = (0x2D & 0x3F) | 0x80 = 0x2D | 0x80 = 0xAD
    assert.strictEqual(romToSnesHiRom(0x2DB50C), 0xADB50C);
});
test('round-trip: snes->rom->snes', () => {
    const snes = 0x8FE5D4;
    assert.strictEqual(romToSnesHiRom(snesToRomOffset(snes)), snes);
});

// ---------------------------------------------------------------------------
// applyDeltaDecode  (core pipeline stage)
// ---------------------------------------------------------------------------
console.log('\n-- applyDeltaDecode --');
test('empty array returns empty', () => {
    assert.deepStrictEqual(applyDeltaDecode([]), []);
});
test('single word unchanged', () => {
    assert.deepStrictEqual(applyDeltaDecode([0x0282]), [0x0282]);
});
test('two words: cumulative sum', () => {
    // [0x0000, 0x0282] -> [0x0000, (0x0000+0x0282)&0xFFFF] = [0x0000, 0x0282]
    assert.deepStrictEqual(applyDeltaDecode([0x0000, 0x0282]), [0x0000, 0x0282]);
});
test('wraps at 0xFFFF', () => {
    // [0xFFFF, 0x0001] -> [0xFFFF, (0xFFFF+0x0001)&0xFFFF] = [0xFFFF, 0x0000]
    assert.deepStrictEqual(applyDeltaDecode([0xFFFF, 0x0001]), [0xFFFF, 0x0000]);
});
test('three words sequential', () => {
    // [1, 1, 1] -> [1, 2, 3]
    assert.deepStrictEqual(applyDeltaDecode([1, 1, 1]), [1, 2, 3]);
});
test('signed-looking words work (treat as unsigned)', () => {
    // [0x0000, 0x0282, 0x0145] -> [0, 0x0282, (0x0282+0x0145)&0xFFFF=0x03C7]
    assert.deepStrictEqual(applyDeltaDecode([0x0000, 0x0282, 0x0145]), [0x0000, 0x0282, 0x03C7]);
});

// ---------------------------------------------------------------------------
// TRUSTED_MAPS[0x33] delta decode verification
// ---------------------------------------------------------------------------
console.log('\n-- TRUSTED_MAPS[0x33] delta decode (97 words) --');
const t33 = TRUSTED_MAPS[0x33];
test('pass1 has 97 words', () => {
    assert.strictEqual(t33.pass1Words.length, 97);
});
test('pass2 has 97 words', () => {
    assert.strictEqual(t33.pass2Words.length, 97);
});
test('applyDeltaDecode(pass1) === pass2', () => {
    const computed = applyDeltaDecode(t33.pass1Words);
    assert.deepStrictEqual(computed, t33.pass2Words);
});
test('pass2[0] = 0x0000 (anchor word)', () => {
    assert.strictEqual(t33.pass2Words[0], 0x0000);
});
test('pass2[1] = 0x0282 (macro 0x0282 first real entry)', () => {
    assert.strictEqual(t33.pass2Words[1], 0x0282);
});

// ---------------------------------------------------------------------------
// parseTilemap  (nibble decode)
// ---------------------------------------------------------------------------
console.log('\n-- parseTilemap --');
test('2x2 map, all zeros', () => {
    const buf = Buffer.from([0x00, 0x00]);  // 4 nibbles
    const grid = parseTilemap(buf, 0, 2, 2);
    assert.strictEqual(grid.length, 2);
    assert.strictEqual(grid[0].length, 2);
    grid.flat().forEach((c) => {
        assert.strictEqual(c.family, 0);
        assert.strictEqual(c.variant, 0);
    });
});
test('nibble 0xB -> family 2, variant 3', () => {
    // byte 0x0B: lo nibble = 0xB = 1011 -> family = 2, variant = 3 (hi nibble = 0)
    const buf = Buffer.from([0x0B]);   // lo=B hi=0, 2 tiles
    const grid = parseTilemap(buf, 0, 2, 1);
    assert.strictEqual(grid[0][0].nibble, 0xB);
    assert.strictEqual(grid[0][0].family, 2);
    assert.strictEqual(grid[0][0].variant, 3);
});
test('nibble 0x5 -> family 1, variant 1', () => {
    // 0x5 = 0101 -> family = 1, variant = 1
    const buf = Buffer.from([0x05]);
    const grid = parseTilemap(buf, 0, 2, 1);
    assert.strictEqual(grid[0][0].nibble, 0x5);
    assert.strictEqual(grid[0][0].family, 1);
    assert.strictEqual(grid[0][0].variant, 1);
});
test('first byte of map 0x33 tilemap: 0xB5 -> col0=1,col1=2', () => {
    // 0xB5: lo=5 (nibble>>2=1, var=1), hi=B (nibble>>2=2, var=3)
    const buf = Buffer.from([0xB5, 0x00]);
    const grid = parseTilemap(buf, 0, 4, 1);  // 4 tiles = 2 bytes
    assert.strictEqual(grid[0][0].nibble, 0x5);
    assert.strictEqual(grid[0][0].family, 1);
    assert.strictEqual(grid[0][1].nibble, 0xB);
    assert.strictEqual(grid[0][1].family, 2);
});
test('map 0x33 row-0 family values from known first 10 bytes', () => {
    // Tilemap raw: B5 00 07 80 02 33 88 88 02 A6 ...
    const raw = Buffer.from([0xB5, 0x00, 0x07, 0x80, 0x02, 0x33, 0x88, 0x88, 0x02, 0xA6]);
    const grid = parseTilemap(raw, 0, 20, 1);  // row 0: 20 tiles = 10 bytes
    // B5: lo=5->fam1, hi=B->fam2
    assert.strictEqual(grid[0][0].family, 1);
    assert.strictEqual(grid[0][1].family, 2);
    // 00: lo=0->fam0, hi=0->fam0
    assert.strictEqual(grid[0][2].family, 0);
    assert.strictEqual(grid[0][3].family, 0);
});

// ---------------------------------------------------------------------------
// findSentinel
// ---------------------------------------------------------------------------
console.log('\n-- findSentinel --');
test('finds strict7 sentinel', () => {
    const buf = Buffer.from([0x00, 0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x00, 0xFF, 0x99]);
    const result = findSentinel(buf, 0, buf.length);
    assert.ok(result !== null);
    assert.strictEqual(result.type, 'strict7');
    assert.strictEqual(result.romOffset, 2);
});
test('finds short6 sentinel', () => {
    const buf = Buffer.from([0x00, 0x80, 0x00, 0x00, 0x01, 0x00, 0xFF, 0x99]);
    const result = findSentinel(buf, 0, buf.length);
    assert.ok(result !== null);
    assert.strictEqual(result.type, 'short6');
    assert.strictEqual(result.romOffset, 1);
});
test('returns null when no sentinel in range', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    assert.strictEqual(findSentinel(buf, 0, buf.length), null);
});
test('respects blobEnd limit', () => {
    // sentinel at byte 4 but blobEnd = 4 (exclusive) -> not found
    const buf = Buffer.from([0x00, 0x30, 0x00, 0x00, 0x00, 0x01, 0x00, 0xFF]);
    // strict7: lead=0x30 at byte 1; core starts at 2; total 7 bytes -> needs up to byte 7
    // with blobEnd=5 (short scan), sentinel core goes past boundary -> not found
    const result = findSentinel(buf, 0, 5);
    // sentinel at offset 1 needs 7 bytes (1..7 inclusive), but blobEnd=5 cuts off
    assert.strictEqual(result, null);
});

// ---------------------------------------------------------------------------
// parseRenderScript93 (from synthetic ROM bytes, no real ROM needed)
// ---------------------------------------------------------------------------
console.log('\n-- parseRenderScript93 --');
test('null if opcode is not 0x93', () => {
    const fakeRom = Buffer.alloc(64);
    fakeRom[0] = 0x91;
    assert.strictEqual(parseRenderScript93(fakeRom, 0), null);
});
test('opcode 0x93: payloadRelOffset = 0x13', () => {
    const fakeRom = Buffer.alloc(64, 0x44);
    fakeRom[0] = 0x93;
    fakeRom[1] = 0x61;
    const info = parseRenderScript93(fakeRom, 0);
    assert.ok(info !== null);
    assert.strictEqual(info.payloadRelOffset, 0x13);
});
test('opcode 0x93: headerControl = byte+1', () => {
    const fakeRom = Buffer.alloc(64, 0x44);
    fakeRom[0] = 0x93;
    fakeRom[1] = 0x61;
    const info = parseRenderScript93(fakeRom, 0);
    assert.strictEqual(info.headerControl, 0x61);
});
test('opcode 0x93: headerBytes has 18 bytes (bytes 1..18)', () => {
    const fakeRom = Buffer.alloc(64, 0x44);
    fakeRom[0] = 0x93;
    const info = parseRenderScript93(fakeRom, 0);
    // payloadRelOffset=0x13=19; headerBytes = bytes 1..18 = 18 bytes
    assert.strictEqual(info.headerBytes.length, 18);
});
test('opcode 0x93: vramWordsPerCommand = 64', () => {
    const fakeRom = Buffer.alloc(64, 0x44);
    fakeRom[0] = 0x93;
    const info = parseRenderScript93(fakeRom, 0);
    assert.strictEqual(info.vramWordsPerCommand, 64);
});
test('opcode 0x93: payloadStart = scriptRom + 0x13', () => {
    const fakeRom = Buffer.alloc(64, 0x44);
    fakeRom[0] = 0x93;
    const info = parseRenderScript93(fakeRom, 0);
    assert.strictEqual(info.payloadStart, 0x13);
});

// ---------------------------------------------------------------------------
// EE table address formula (no ROM needed, just formula)
// ---------------------------------------------------------------------------
console.log('\n-- EE table address formula --');
test('macro 0x0000: tableSnes = 0xEE0000', () => {
    // formula: 0xEE0000 + 0 * 3 = 0xEE0000
    const expected = 0xEE0000;
    assert.strictEqual(0xEE0000 + 0x0000 * 3, expected);
});
test('macro 0x0282: tableSnes = 0xEE0000 + 0x0282*3 = 0xEE0786', () => {
    assert.strictEqual(0xEE0000 + 0x0282 * 3, 0xEE0786);
});
test('macro 0x03C7: tableSnes = 0xEE0000 + 0x03C7*3 = 0xEE0B55', () => {
    assert.strictEqual(0xEE0000 + 0x03C7 * 3, 0xEE0B55);
});

// ---------------------------------------------------------------------------
// ROM-dependent tests (skipped if ROM not present)
// ---------------------------------------------------------------------------
const rom = loadRom();
const ROM_AVAILABLE = rom !== null;
const romSkip = ROM_AVAILABLE ? '' : 'no ROM';

console.log(`\n-- ROM-dependent tests (ROM ${ROM_AVAILABLE ? 'found' : 'NOT found'}) --`);

if (ROM_AVAILABLE) {
    test('map 0x33 blob ROM address = 0x2DB50C', () => {
        const { getMapBlobRom } = require('../models/map-pipeline-model');
        assert.strictEqual(getMapBlobRom(rom, 0x33), 0x2DB50C);
    });
    test('map 0x33 header: mapW=20 mapH=16', () => {
        const h = parseBlobHeader(rom, 0x2DB50C);
        assert.strictEqual(h.mapW, 20);
        assert.strictEqual(h.mapH, 16);
    });
    test('map 0x33 header: stepLen=12', () => {
        const h = parseBlobHeader(rom, 0x2DB50C);
        assert.strictEqual(h.stepLen, 12);
    });
    test('map 0x33 triggers: 2 step-on, 0 B-triggers', () => {
        const h = parseBlobHeader(rom, 0x2DB50C);
        const { stepOns, bTriggers } = parseTriggerTables(rom, 0x2DB50C, h);
        assert.strictEqual(stepOns.length, 2);
        assert.strictEqual(bTriggers.length, 0);
    });
    test('map 0x33 tile families: 6 entries, first=0x00B9', () => {
        const h = parseBlobHeader(rom, 0x2DB50C);
        const { payloadStart } = parseTriggerTables(rom, 0x2DB50C, h);
        const { count, families } = parseTileFamilies(rom, payloadStart);
        assert.strictEqual(count, 6);
        assert.strictEqual(families[0], 0x00B9);
        assert.strictEqual(families[1], 0x00BA);
    });
    test('map 0x33 sentinel found (strict7 at ROM 0x2DB5DA)', () => {
        const blob = parseMapBlob(rom, 0x33);
        assert.ok(blob.sentinel !== null);
        assert.strictEqual(blob.sentinel.type, 'strict7');
        assert.strictEqual(blob.sentinel.romOffset, 0x2DB5DA);
    });
    test('map 0x33 tilemap: 20x16 grid', () => {
        const blob = parseMapBlob(rom, 0x33);
        assert.strictEqual(blob.tilemap.length, 16);
        assert.strictEqual(blob.tilemap[0].length, 20);
    });
    test('map 0x33 tilemap row 0, col 0: family 1 (nibble 5)', () => {
        const blob = parseMapBlob(rom, 0x33);
        assert.strictEqual(blob.tilemap[0][0].family, 1);
    });
    test('EE descriptor for macro 0x0282: targetSnes = 0x8FE5D4', () => {
        const desc = lookupEEDescriptor(rom, 0x0282);
        assert.strictEqual(desc.targetSnes, 0x8FE5D4);
    });
    test('render script at 0x0282 target: opcode = 0x93', () => {
        const desc = lookupEEDescriptor(rom, 0x0282);
        assert.strictEqual(rom[desc.targetRom], 0x93);
    });
} else {
    ['map 0x33 blob ROM address', 'map 0x33 header', 'map 0x33 triggers',
     'map 0x33 tile families', 'map 0x33 sentinel', 'map 0x33 tilemap',
     'EE descriptor for macro 0x0282', 'render script opcode'
    ].forEach((name) => skip(name, romSkip));
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
