'use strict';

const assert = require('assert');
const {
    MAP_LIST_ADDR_US,
    SCRIPTS_START_ADDR_US,
    ENTER_SCRIPT_TABLE_OFFSET,
    ROOM_TRIGGER_ENTRY_SIZE,
    snesToRomOffset,
    snesToScriptValue,
    decodeRoomScript,
    buildRoomScriptModelFromRom,
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
        0x18, 0x43, 0x24, 0x02,
        0x08, 0xEB, 0x22, 0x20, 0x08, 0x00,
        0x20, 0x1D, 0x15,
        0xA3, 0x00,
        0x04, 0x05,
        0x0C, 0xEB, 0x22, 0xDF,
        0x1B, 0xE9, 0x23, 0x00, 0x00, 0x00, 0x00,
        0x1B, 0xED, 0x23, 0x40, 0x01, 0x00, 0x01,
        0x09, 0x8D, 0x23, 0x00, 0x04, 0x00,
        0x33, 0x12,
        0xA3, 0x01,
        0x18, 0xBF, 0x23, 0x01,
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

test('decodes enter script opcodes including 0x1b room-bound writes and trailing end', () => {
    const { rom, mapId, enterScriptSnes } = buildFixtureRom();
    const room = buildRoomScriptModelFromRom(rom, mapId);
    assert.strictEqual(room.enter.scriptAddressSnes, enterScriptSnes, 'wrong enter script address');
    assert.ok(room.enter.instructions.some((row) => row.opcode === 0x1b && row.size === 7), 'expected opcode 0x1b size 7 in enter script');
    assert.strictEqual(room.enter.instructions[room.enter.instructions.length - 1].opcode, 0x00, 'enter script must end with opcode 0x00');
    assert.strictEqual(room.enter.terminated, true, 'enter script should terminate on 0x00');
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);