'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    MAP_LIST_ADDR_US,
    SCRIPTS_START_ADDR_US,
    ENTER_SCRIPT_TABLE_OFFSET,
    ROOM_TRIGGER_ENTRY_SIZE,
    snesToRomOffset,
    snesToScriptValue,
    OPCODE_REGISTRY,
    decodeRoomScript,
    buildRoomScriptModelFromRom,
    readRoomScriptModel,
} = require('../emulator/room-script-model');

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

function findPracticalRomPath() {
    const candidates = [
        process.env.EVERSCRIPT_ROM_PATH,
        path.resolve(__dirname, '../../../everscript/Secret of Evermore (U) [!].smc'),
        path.resolve(__dirname, '../../../everscript/out/Secret of Evermore (U) [!].smc'),
    ].filter(Boolean);
    return candidates.find((filePath) => fs.existsSync(filePath)) || '';
}

function writeU16(buf, romOffset, value) {
    buf[romOffset] = value & 0xff;
    buf[romOffset + 1] = (value >> 8) & 0xff;
}

function writeU24(buf, romOffset, value) {
    buf[romOffset] = value & 0xff;
    buf[romOffset + 1] = (value >> 8) & 0xff;
    buf[romOffset + 2] = (value >> 16) & 0xff;
}

function writeScriptPointer(buf, pointerSnes, scriptSnes) {
    writeU24(buf, snesToRomOffset(pointerSnes), snesToScriptValue(scriptSnes));
}

function writeScriptBytes(buf, scriptSnes, bytes) {
    const rom = snesToRomOffset(scriptSnes);
    for (let i = 0; i < bytes.length; i++) buf[rom + i] = bytes[i];
}

function buildFixtureRom() {
    const rom = Buffer.alloc(0x300000, 0x00);
    const mapId = 0x33;
    const dataSnes = 0x92A000;
    const dataRom = snesToRomOffset(dataSnes);
    const mapListRom = snesToRomOffset(MAP_LIST_ADDR_US) + mapId * 4;
    const mapscriptTableSnes = 0x928400;
    const enterScriptSnes = 0x94E5FB;
    const step1ScriptSnes = 0x94E5E7;
    const step2ScriptSnes = 0x94E5F1;
    const stepLen = 2 * ROOM_TRIGGER_ENTRY_SIZE;

    writeU24(rom, mapListRom, dataSnes);
    writeU16(rom, dataRom + 0x0d, stepLen);

    rom[dataRom + 0x0f + 0] = 0x0f;
    rom[dataRom + 0x0f + 1] = 0x27;
    rom[dataRom + 0x0f + 2] = 0x10;
    rom[dataRom + 0x0f + 3] = 0x28;
    writeU16(rom, dataRom + 0x0f + 4, 0x0735);

    rom[dataRom + 0x15 + 0] = 0x0c;
    rom[dataRom + 0x15 + 1] = 0x2f;
    rom[dataRom + 0x15 + 2] = 0x0e;
    rom[dataRom + 0x15 + 3] = 0x32;
    writeU16(rom, dataRom + 0x15 + 4, 0x0738);

    writeU16(rom, dataRom + 0x0f + stepLen, 0x0000);
    writeU16(rom, snesToRomOffset(SCRIPTS_START_ADDR_US), 0x0400);

    writeScriptPointer(rom, SCRIPTS_START_ADDR_US + ENTER_SCRIPT_TABLE_OFFSET + mapId * 5, enterScriptSnes);
    writeScriptPointer(rom, mapscriptTableSnes + 0x0735, step1ScriptSnes);
    writeScriptPointer(rom, mapscriptTableSnes + 0x0738, step2ScriptSnes);

    writeScriptBytes(rom, step1ScriptSnes, [0xA3, 0x00, 0xA3, 0x27, 0x22, 0x12, 0x23, 0x34, 0x00, 0x00]);
    writeScriptBytes(rom, step2ScriptSnes, [0xA3, 0x00, 0xA3, 0x1D, 0x22, 0x04, 0x1F, 0x38, 0x00, 0x00]);
    writeScriptBytes(rom, enterScriptSnes, [
        0x18, 0xEB, 0x01, 0xB2,
        0x08, 0x85, 0x9D, 0x04, 0x08, 0x00,
        0x20, 0x1D, 0x15,
        0xA3, 0x00,
        0x04, 0x04, 0x00,
        0x0C, 0x9D, 0x04, 0xB0,
        0x1B, 0x91, 0x01, 0x93, 0x01, 0x00, 0x00,
        0x1B, 0x95, 0x01, 0x97, 0x01, 0x28, 0x20,
        0x09, 0x88, 0x35, 0x01, 0x04, 0x00,
        0x33, 0x12,
        0xA3, 0x01,
        0x18, 0x67, 0x01, 0xB1,
        0x29, 0x75, 0xDE, 0x92,
        0xA7, 0x0E,
        0x86, 0x64,
        0x00,
    ]);

    return { rom, mapId, step1ScriptSnes, enterScriptSnes };
}

console.log('room-script-model:');

test('decodes opcode sizes and termination for a step-on transition script', () => {
    const { rom, step1ScriptSnes } = buildFixtureRom();
    const script = decodeRoomScript(rom, step1ScriptSnes);
    assert.deepStrictEqual(script.instructions.map((row) => row.opcode), [0xA3, 0xA3, 0x22, 0x00]);
    assert.deepStrictEqual(script.instructions.map((row) => row.size), [2, 2, 5, 1]);
    assert.strictEqual(script.terminated, true, 'expected trailing 0x00 terminator');
    assert.ok(script.instructions[2].summary.includes('CHANGE MAP = 0x34'), 'expected CHANGE MAP decode for opcode 0x22');
});

test('builds room trigger counts and script ids from ROM room data', () => {
    const { rom, mapId } = buildFixtureRom();
    const room = buildRoomScriptModelFromRom(rom, mapId);
    assert.strictEqual(room.meta.stepLength, 12, 'wrong step-on section length');
    assert.strictEqual(room.meta.stepCount, 2, 'wrong step-on count');
    assert.strictEqual(room.meta.bCount, 0, 'wrong B-trigger count');
    assert.strictEqual(room.stepOn.length, 2, 'wrong number of parsed step-on entries');
    assert.strictEqual(room.stepOn[0].scriptId, 0x0735, 'wrong first step-on script id');
    assert.strictEqual(room.stepOn[1].scriptId, 0x0738, 'wrong second step-on script id');
});

test('keeps coordinate ordering as x1,y1:x2,y2 like the tiles viewer', () => {
    const { rom, mapId } = buildFixtureRom();
    const room = buildRoomScriptModelFromRom(rom, mapId);
    assert.deepStrictEqual(
        { x1: room.stepOn[0].x1, y1: room.stepOn[0].y1, x2: room.stepOn[0].x2, y2: room.stepOn[0].y2 },
        { x1: 0x27, y1: 0x0f, x2: 0x28, y2: 0x10 },
    );
});

test('decodes enter script opcodes including offset-based writes and trailing end', () => {
    const { rom, mapId, enterScriptSnes } = buildFixtureRom();
    const room = buildRoomScriptModelFromRom(rom, mapId);
    assert.strictEqual(room.enter.scriptAddressSnes, enterScriptSnes, 'wrong enter script address');
    assert.ok(room.enter.instructions.some((row) => row.opcode === 0x1b && row.size === 7), 'expected opcode 0x1b size 7 in enter script');
    assert.ok(room.enter.instructions[0].summary.includes('CHANGE DOGGO'), 'expected opcode 0x18 to resolve the doggo write');
    assert.ok(room.enter.instructions.some((row) => row.summary.includes('in animation')), 'expected opcode 0x08/0x0c to resolve the animation flag');
    assert.ok(room.enter.instructions.some((row) => row.summary.includes('MAP X/Y start')), 'expected opcode 0x1b to resolve map bounds writes');
    assert.strictEqual(room.enter.instructions[room.enter.instructions.length - 1].opcode, 0x00, 'enter script must end with opcode 0x00');
    assert.strictEqual(room.enter.terminated, true, 'enter script should terminate on 0x00');
});

test('decodes additional fixed-width opcodes without treating them as unknown', () => {
    const rom = Buffer.alloc(0x300000, 0x00);
    const scriptSnes = 0x928600;
    writeScriptBytes(rom, scriptSnes, [
        0x51, 0x34, 0x12,
        0x54, 0x02,
        0x58,
        0xA4, 0x78, 0x56,
        0xA6, 0x04, 0x00,
        0xA8, 0x10, 0x00,
        0xAB,
    ]);
    const script = decodeRoomScript(rom, scriptSnes);
    assert.deepStrictEqual(script.instructions.map((row) => row.opcode), [0x51, 0x54, 0x58, 0xA4, 0xA6, 0xA8, 0xAB]);
    assert.ok(script.instructions.every((row) => !row.summary.startsWith('UNKNOWN OPCODE')), 'expected supported summaries for the new fixed-width opcodes');
    assert.ok(script.instructions[0].summary.includes('SHOW TEXT 0x1234 WINDOWED'), 'expected SHOW TEXT summary');
    assert.ok(script.instructions[3].summary.includes('CALL SHORT SCRIPT 0x5678'), 'expected short-call summary');
    assert.ok(script.instructions[4].summary.includes('RCALL 4'), 'expected relative-call summary');
    assert.ok(script.instructions[5].summary.includes('SLEEP 15 TICKS'), 'expected 16-bit sleep summary');
    assert.strictEqual(script.stopReason, 'unsupported-opcode', 'reset-game opcode should still stop further decode');
});

test('decodes opcode 0x0f as a script-arg bit test', () => {
    const rom = Buffer.alloc(0x300000, 0x00);
    const scriptSnes = 0x928680;
    writeScriptBytes(rom, scriptSnes, [0x0F, 0x1D, 0x00]);
    const script = decodeRoomScript(rom, scriptSnes);
    assert.deepStrictEqual(script.instructions.map((row) => row.opcode), [0x0F, 0x00]);
    assert.strictEqual(script.instructions[0].size, 2, 'expected opcode 0x0f to consume 2 bytes');
    assert.ok(script.instructions[0].summary.includes('ARG 3 & 0x20'), 'expected arg-bit summary for opcode 0x0f');
    assert.strictEqual(script.terminated, true, 'expected trailing 0x00 terminator');
});

test('includes full opcode registry from SoEScriptDumper ground truth', () => {
    const expected = [
        0x00, 0x04, 0x05, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x10, 0x11, 0x14, 0x15, 0x17, 0x18, 0x19,
        0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x20, 0x22, 0x26, 0x27, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x30, 0x31, 0x32,
        0x33, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d, 0x3f, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b,
        0x4d, 0x4e, 0x50, 0x51, 0x52, 0x54, 0x55, 0x58, 0x59, 0x5a, 0x5b, 0x5c, 0x5d, 0x62, 0x63, 0x6c, 0x6d, 0x6e,
        0x6f, 0x70, 0x71, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x7c, 0x7d, 0x7e, 0x7f, 0x80, 0x81, 0x82,
        0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8c, 0x8d, 0x8e, 0x8f, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96,
        0x97, 0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8,
        0xa9, 0xaa, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb,
        0xbc, 0xbd, 0xbe, 0xbf, 0xc0, 0xc1, 0xc2,
    ];
    const actual = Object.keys(OPCODE_REGISTRY)
        .map((key) => Number.parseInt(key, 10))
        .sort((a, b) => a - b);
    assert.deepStrictEqual(actual, expected, 'opcode registry must match SoEScriptDumper printscript switch');
});

test('decodes a mixed script using opcodes previously unsupported', () => {
    const rom = Buffer.alloc(0x300000, 0x00);
    const scriptSnes = 0x928780;
    writeScriptBytes(rom, scriptSnes, [
        0x05, 0xfe,
        0x07, 0x34, 0x12, 0x9a,
        0x0a, 0xb0, 0x10, 0x00, 0x00, 0x04, 0x00,
        0x2a, 0xd0,
        0x3d, 0xd0, 0x34, 0x12,
        0x42, 0xd0, 0x08, 0x09,
        0x6e, 0xd0, 0x10, 0x20,
        0x8e, 0xb0, 0xb1, 0x02, 0x00,
        0xa2, 0x22, 0x00, 0x40, 0x00, 0xb2, 0xb3,
        0xb0, 0x02, 0xb2, 0xb3, 0x39,
        0xc2, 0x01, 0x02, 0x03,
        0x00,
    ]);

    const script = decodeRoomScript(rom, scriptSnes);
    assert.strictEqual(script.stopReason, 'terminated', 'mixed opcode script should fully decode and terminate');
    assert.ok(script.instructions.every((row) => !row.summary.startsWith('UNKNOWN OPCODE')), 'mixed opcode script should not hit unknown opcodes');
});

test('matches practical room 0x33 summaries from the local ROM-backed dump when available', () => {
    const romPath = findPracticalRomPath();
    if (!romPath) {
        console.log('  - skipped practical room 0x33 test (no local ROM found)');
        return;
    }
    const room = readRoomScriptModel(process.cwd(), 0x33, romPath);
    assert.ok(room, 'expected room 0x33 to decode from the local ROM');
    const enterSummaries = room.enter.instructions.map((row) => row.summary);
    assert.ok(enterSummaries.includes('WRITE CHANGE DOGGO ($2443) = Wolf (0x02)'), 'expected room 0x33 enter script to decode the doggo write');
    assert.ok(enterSummaries.includes('IF in animation ($22EB) SKIP 8 (to 0x94E60D)'), 'expected room 0x33 enter script to decode the animation flag branch');
    assert.ok(enterSummaries.includes('WRITE MAP X/Y start ($23E9) / $23EB = 0x0000 / 0x0000'), 'expected room 0x33 enter script to decode the starting map bounds');
    assert.ok(enterSummaries.includes('IF CHANGE MUSIC ($238D) == 0x00 SKIP 4 (to 0x94E629)'), 'expected room 0x33 enter script to decode the music branch');
    assert.deepStrictEqual(
        room.stepOn.map((trigger) => ({ x1: trigger.x1, y1: trigger.y1, x2: trigger.x2, y2: trigger.y2, label: trigger.label })),
        [
            { x1: 0x27, y1: 0x0f, x2: 0x28, y2: 0x10, label: 'CALL "Fade-out / stop music" (0x00)' },
            { x1: 0x2f, y1: 0x0c, x2: 0x32, y2: 0x0e, label: 'CALL "Fade-out / stop music" (0x00)' },
        ],
    );
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);