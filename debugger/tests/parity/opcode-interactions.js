'use strict';

const assert = require('assert');
const { decodeRoomScript, snesToRomOffset } = require('../../emulator/room-script-model');

function writeScriptBytes(buf, scriptSnes, bytes) {
    const rom = snesToRomOffset(scriptSnes);
    for (let i = 0; i < bytes.length; i++) buf[rom + i] = bytes[i];
}

function runOpcodeInteractionTests(test) {
    test('interaction: IF + SKIP + CALL keeps aligned PC and branch target', () => {
        const rom = Buffer.alloc(0x300000, 0x00);
        const scriptSnes = 0x928900;
        writeScriptBytes(rom, scriptSnes, [
            0x08, 0x85, 0x9D, 0x04, 0x08, 0x00,
            0x29, 0x34, 0x12, 0x9A,
            0x00,
        ]);
        const script = decodeRoomScript(rom, scriptSnes);
        assert.strictEqual(script.stopReason, 'terminated');
        assert.strictEqual(script.instructions[0].addressSnes, scriptSnes);
        assert.strictEqual(script.instructions[1].addressSnes, scriptSnes + script.instructions[0].size);
    });

    test('interaction: WRITE + CONDITIONAL BRANCH preserves instruction boundaries', () => {
        const rom = Buffer.alloc(0x300000, 0x00);
        const scriptSnes = 0x928940;
        writeScriptBytes(rom, scriptSnes, [
            0x18, 0x67, 0x01, 0xB1,
            0x09, 0x88, 0x35, 0x01, 0x04, 0x00,
            0x33, 0x12,
            0x00,
        ]);
        const script = decodeRoomScript(rom, scriptSnes);
        assert.strictEqual(script.stopReason, 'terminated');
        const addrs = script.instructions.map((row) => row.addressSnes);
        for (let i = 1; i < addrs.length; i++) {
            assert.ok(addrs[i] > addrs[i - 1], 'addresses must be strictly increasing');
        }
    });

    test('interaction: TELEPORT + STATE CHANGE + MUSIC CONTROL has deterministic summaries', () => {
        const rom = Buffer.alloc(0x300000, 0x00);
        const scriptSnes = 0x928980;
        writeScriptBytes(rom, scriptSnes, [
            0x20, 0x1D, 0x15,
            0x18, 0x67, 0x01, 0xB1,
            0x33, 0x12,
            0xA3, 0x01,
            0x00,
        ]);

        const first = decodeRoomScript(rom, scriptSnes);
        const second = decodeRoomScript(rom, scriptSnes);

        assert.strictEqual(first.stopReason, 'terminated');
        assert.deepStrictEqual(
            first.instructions.map((row) => row.summary),
            second.instructions.map((row) => row.summary),
            'decode must be deterministic',
        );
    });

    test('interaction: nested SKIP chain keeps PC monotonic', () => {
        const rom = Buffer.alloc(0x300000, 0x00);
        const scriptSnes = 0x9289C0;
        writeScriptBytes(rom, scriptSnes, [
            0x04, 0x03, 0x00,
            0x04, 0x03, 0x00,
            0x29, 0x34, 0x12, 0x9A,
            0x00,
        ]);

        const script = decodeRoomScript(rom, scriptSnes);
        assert.strictEqual(script.stopReason, 'terminated');
        let expected = scriptSnes;
        for (const row of script.instructions) {
            assert.strictEqual(row.addressSnes, expected, 'instruction PC desync');
            expected += row.size;
        }
    });
}

module.exports = {
    runOpcodeInteractionTests,
};
