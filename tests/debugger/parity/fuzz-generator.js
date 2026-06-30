'use strict';

const assert = require('assert');
const { OPCODE_REGISTRY, decodeRoomScript, snesToRomOffset } = require('../../../src/emulator/room-script-model');

function makeRng(seed) {
    let state = seed >>> 0;
    return function rand() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function randInt(rand, min, max) {
    return min + Math.floor(rand() * (max - min + 1));
}

function emitU16(bytes, value) {
    bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function emitU24(bytes, value) {
    bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff);
}

function emitSubexpr(bytes, rand) {
    // Emit final typed literal (0xB0..0xBF), compatible with SoEScriptDumper sub parser.
    bytes.push(0xB0 | randInt(rand, 0, 0x0f));
}

function encodeOperand(bytes, operand, rand, opcode) {
    switch (operand) {
        case 'u8': bytes.push(randInt(rand, 0, 0xff)); return true;
        case 'u16': emitU16(bytes, randInt(rand, 0, 0xffff)); return true;
        case 'u24': emitU24(bytes, randInt(rand, 0, 0xffffff)); return true;
        case 's8': bytes.push(randInt(rand, 0, 0xff)); return true;
        case 's16': emitU16(bytes, randInt(rand, 0, 0xffff)); return true;
        case 'subexpr': emitSubexpr(bytes, rand); return true;
        case 'subexpr*': emitSubexpr(bytes, rand); return true;
        case 'targets':
            emitSubexpr(bytes, rand); // one target
            bytes.push(0xB0); // terminating zero target
            return true;
        default:
            if (operand === 'variant') {
                // Use conservative encodings for variant-driven opcodes.
                if (opcode === 0x2e) { bytes.push(0xD0); return true; }
                if (opcode === 0x3f) { bytes.push(0xD0, 0x40, 0x34, 0x12); return true; }
                emitSubexpr(bytes, rand);
                return true;
            }
            if (operand === 'target') {
                emitU24(bytes, randInt(rand, 0, 0xffffff));
                return true;
            }
            return false;
    }
}

function encodableOpcodes() {
    return Object.values(OPCODE_REGISTRY).filter((def) => {
        if (def.id === 0x00) return false;
        for (const op of def.operands || []) {
            if (op === 'subexpr*' || op === 'target' || op === 'variant' || op === 'targets') return false;
            if (!['u8', 'u16', 'u24', 's8', 's16', 'subexpr', 'subexpr*', 'targets', 'variant', 'target'].includes(op)) {
                return false;
            }
        }
        return true;
    });
}

function opcodeDecodesWithoutUnknown(def) {
    const rand = makeRng((def.id << 8) ^ 0xC0DE);
    const bytes = [def.id];
    for (const operand of def.operands || []) {
        if (!encodeOperand(bytes, operand, rand, def.id)) return false;
    }
    bytes.push(0x00);

    const scriptSnes = 0x928A00;
    const rom = Buffer.alloc(0x300000, 0x00);
    const romOffset = snesToRomOffset(scriptSnes);
    for (let i = 0; i < bytes.length; i++) rom[romOffset + i] = bytes[i];

    const parsed = decodeRoomScript(rom, scriptSnes);
    if (!parsed.instructions.length) return false;
    const first = parsed.instructions[0];
    if (first.opcode !== def.id) return false;
    if ((first.summary || '').startsWith('UNKNOWN OPCODE')) return false;
    if (first.size !== (bytes.length - 1)) return false;
    return true;
}

function buildRandomScript(seed, instructionCount) {
    const rand = makeRng(seed);
    const defs = encodableOpcodes().filter(opcodeDecodesWithoutUnknown);
    const bytes = [];

    for (let i = 0; i < instructionCount; i++) {
        const def = defs[randInt(rand, 0, defs.length - 1)];
        bytes.push(def.id);
        for (const operand of def.operands || []) {
            encodeOperand(bytes, operand, rand, def.id);
        }
    }
    bytes.push(0x00);
    return bytes;
}

function runParserFuzzTests(test) {
    test('fuzz: randomized valid opcode streams keep deterministic parse and PC alignment', () => {
        const scriptSnes = 0x928A40;
        for (let seed = 1; seed <= 40; seed++) {
            const rom = Buffer.alloc(0x300000, 0x00);
            const bytes = buildRandomScript(seed, 30);
            const romOffset = snesToRomOffset(scriptSnes);
            for (let i = 0; i < bytes.length; i++) rom[romOffset + i] = bytes[i];

            const a = decodeRoomScript(rom, scriptSnes);
            const b = decodeRoomScript(rom, scriptSnes);

            assert.deepStrictEqual(
                a.instructions.map((row) => [row.addressSnes, row.opcode, row.size, row.summary]),
                b.instructions.map((row) => [row.addressSnes, row.opcode, row.size, row.summary]),
                `seed ${seed}: parser must be deterministic`,
            );

            let pc = scriptSnes;
            for (const row of a.instructions) {
                assert.strictEqual(row.addressSnes, pc, `seed ${seed}: PC desync at opcode 0x${row.opcode.toString(16)}`);
                pc += row.size;
            }

            // Registry-complete opcodes should not degrade into unknown for generated stream before END.
            const unknown = a.instructions.filter((row) => row.opcode !== 0x00 && row.summary.startsWith('UNKNOWN OPCODE'));
            assert.strictEqual(unknown.length, 0, `seed ${seed}: unexpected unknown opcode during fuzz parse`);
        }
    });
}

module.exports = {
    runParserFuzzTests,
};
