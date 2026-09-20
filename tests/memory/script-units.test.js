'use strict';
// Unit tests for the script decoder, without a ROM or the SoETilesViewer
// checkout. script-parity.test.js proves the whole decoder agrees with
// SoEScriptDumper across the real ROM; these pin the individual rules, so a
// change that happens to keep the aggregate number up still fails here.

const assert = require('assert');
const script = require('../../src/script');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

/** A ROM containing just these bytes at SNES 0x928000. */
function romWith(bytes) {
    const rom = new Uint8Array(0x400000);
    rom.set(bytes, script.snesToRom(0x928000));
    return rom;
}
const AT = 0x928000;

// ── addressing ──────────────────────────────────────────────────────────────

test('snesToRom drops the HiROM mirror bits', () => {
    assert.strictEqual(script.snesToRom(0x9384d9), 0x1384d9);
    assert.strictEqual(script.snesToRom(0xd384d9), 0x1384d9, 'mirrored bank is the same byte');
});

test('script pointers unpack with a doubled bank', () => {
    // Low 15 bits are an offset in a bank; everything above counts banks, so
    // it shifts left on the way out.
    assert.strictEqual(script.scriptValueToSnes(0x000000), 0x928000);
    assert.strictEqual(script.scriptValueToSnes(0x000133), 0x928133);
    const round = (v) => script.snesToScriptValue(script.scriptValueToSnes(v));
    for (const v of [0, 0x133, 0x7fff, 0x8000, 0x1234f]) assert.strictEqual(round(v), v, 'round trip ' + v);
});

// ── expression grammar ──────────────────────────────────────────────────────

function expr(bytes) {
    return script.parseExpression(romWith(bytes), AT, new script.OperandStack());
}

test('bit 7 ends an expression', () => {
    // 0xb5 is an inline value with the terminator bit: one byte, done.
    const e = expr([0xb5]);
    assert.strictEqual(e.length, 1);
    assert.strictEqual(e.ok, true);
    assert.strictEqual(e.text, '5');
});

test('inline constants cover the three small ranges', () => {
    assert.strictEqual(expr([0xb5]).text, '5', '0x3n is 0..15');
    assert.strictEqual(expr([0xc1]).text, '-15', '0x4n is negative');
    assert.strictEqual(expr([0xe0]).text, '16', '0x6n is 16..31');
});

test('entity tokens read the same with or without the terminator bit', () => {
    assert.strictEqual(expr([0xd0]).text, 'boy');
    assert.strictEqual(expr([0xd1]).text, 'dog');
    // 0x50 is the same token mid-expression; it needs a terminator after it.
    assert.strictEqual(expr([0x50, 0xb1]).text, 'boy 1');
});

test('a word constant costs three bytes, not one', () => {
    // This is the whole reason the previous decoder desynced: operand length
    // depends on the operand, so a fixed size is wrong.
    const e = expr([0x84, 0x34, 0x12]);
    assert.strictEqual(e.length, 3);
    assert.strictEqual(e.text, '0x1234');
});

test('a variable read resolves against its bank base', () => {
    // 0x09 reads a word at 0x2258 + offset; 0x0d is the temp bank at 0x2834.
    assert.strictEqual(expr([0x89, 0x10, 0x00]).text, '$2268');
    assert.strictEqual(expr([0x8d, 0x10, 0x00]).text, '$2844');
});

test('a bit test splits the word into address and bit', () => {
    // The word is a bit index: 0x0210 >> 3 = 0x42 selects $2258+0x42 = $229a,
    // and the low 3 bits pick the mask.
    assert.strictEqual(expr([0x85, 0x10, 0x02]).text, '$229a&0x01');
    assert.strictEqual(expr([0x85, 0x13, 0x02]).text, '$229a&0x08', 'bit 3');
});

test('operators pop the pushed operand and bracket compound sides', () => {
    // push(arg0&0xff), then a word, then '+'. The pushed side is compound, so
    // it gets brackets; the plain constant does not.
    const e = expr([0x11, 0x00, 0x29, 0x04, 0x34, 0x12, 0x9a]);
    assert.strictEqual(e.ok, true);
    assert.strictEqual(e.text, '(arg0&0xff) + 0x1234');
    // A simple left side stays bare.
    assert.strictEqual(expr([0x35, 0x29, 0x04, 0x34, 0x12, 0x9a]).text, '5 + 0x1234');
});

test('an operator with nothing pushed fails instead of inventing a value', () => {
    const e = expr([0x9a]);
    assert.strictEqual(e.ok, false);
});

test('an unknown sub-instruction stops the expression', () => {
    const e = expr([0x30, 0xfa]);
    assert.strictEqual(e.ok, false);
    assert.ok(/unknown|invalid/.test(e.text), e.text);
});

test('the operand stack survives across expressions but is dropped on failure', () => {
    const stack = new script.OperandStack();
    const rom = romWith([0xb5, 0x29]);
    // push leaves a value behind for a later operand — real scripts rely on it
    script.parseExpression(rom, AT, stack);
    stack.push(1, 'x');
    assert.strictEqual(stack.empty, false);
    script.parseExpression(romWith([0x9a]), AT, stack);  // pops nothing, fails
    assert.strictEqual(stack.empty, true, 'a failed parse clears the stack');
});

// ── instruction decoding ────────────────────────────────────────────────────

test('END terminates a script', () => {
    const res = script.decodeScript(romWith([0x00]), AT);
    assert.strictEqual(res.stopReason, 'terminated');
    assert.strictEqual(res.instructions.length, 1);
    assert.strictEqual(res.instructions[0].terminal, true);
});

test('a WRITE sizes itself from its value byte', () => {
    // [2-byte dest][type]: inline value, 1-byte literal, 2-byte literal.
    const dest = [0xe9, 0x01];
    const size = (tail) => script.decodeInstruction(
        romWith([0x18].concat(dest, tail)), AT, new script.OperandStack()).size;
    assert.strictEqual(size([0xb5]), 4, 'value packed into the type byte');
    assert.strictEqual(size([0x82, 0x07]), 5, 'byte literal');
    assert.strictEqual(size([0x84, 0x34, 0x12]), 6, 'word literal');
    assert.strictEqual(size([0x89, 0x10, 0x00]), 6, 'or an expression');
});

test('decoding stops rather than guessing an unknown opcode', () => {
    // 0x01 is UNKNOWN INSTR to SoEScriptDumper too, so no length is known.
    const res = script.decodeScript(romWith([0x01, 0x00]), AT);
    assert.strictEqual(res.stopReason, 'unknown-opcode');
    assert.strictEqual(res.stoppedAt, AT);
    assert.ok(/cannot decode/.test(script.unresolvedNote(0x01)));
});

test('a script past the end of a short ROM stops instead of reading zeroes', () => {
    const res = script.decodeScript(new Uint8Array(0x100), 0x928000);
    assert.strictEqual(res.stopReason, 'out-of-rom');
    assert.strictEqual(res.instructions.length, 0);
});

console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
