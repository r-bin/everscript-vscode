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

// ── summaries ───────────────────────────────────────────────────────────────

function summary(bytes) {
    const ins = script.decodeInstruction(romWith(bytes), AT, new script.OperandStack());
    assert.ok(ins, 'opcode 0x' + bytes[0].toString(16) + ' has no case');
    return ins.summary;
}

test('a write names both the address and the value', () => {
    // 0x2443 is CHANGE DOGGO and 0x02 is the Wolf, both from data.h.
    assert.strictEqual(summary([0x18, 0xeb, 0x01, 0xb2]), 'WRITE CHANGE DOGGO ($2443) = Wolf (0x02)');
    // An address with no curated name still reads as an address.
    assert.strictEqual(summary([0x18, 0x67, 0x01, 0xb1]), 'WRITE $23bf = 0x0001');
});

test('a flag test names the flag', () => {
    assert.strictEqual(summary([0x08, 0x85, 0x00, 0x00, 0x00, 0x00]),
        'IF $2258&0x01 (Acid Rain) SKIP 0 (to 0x928006)');
});

test('CHANGE MAP names the destination room', () => {
    assert.strictEqual(summary([0x22, 0x12, 0x23, 0x34, 0x00]),
        'CHANGE MAP = 0x34 @ [ 0x0090 | 0x0118 ]: "Prehistoria - Strong Heart\'s Hut"');
});

test('CALL names the global script it invokes', () => {
    assert.strictEqual(summary([0xa3, 0x00]), 'CALL "Fade-out / stop music" (0x00)');
    // An id with no curated name still says which id it is.
    assert.ok(/Unnamed Global script 0xfe/.test(summary([0xa3, 0xfe])));
});

test('SLEEP counts one tick less than the operand', () => {
    assert.strictEqual(summary([0xa7, 0x0f]), 'SLEEP 14 TICKS');
});

test('CALL-with-args takes its length from the argument count', () => {
    // [count][count x expression][16-bit script id]. Reading the count as a
    // fixed-width field is what produced 571-byte instructions before.
    const ins = script.decodeInstruction(
        romWith([0xb1, 0x02, 0xb5, 0xb6, 0x34, 0x12]), AT, new script.OperandStack());
    assert.strictEqual(ins.size, 6);
    assert.ok(/WITH 2 ARGS 5, 6$/.test(ins.summary), ins.summary);
});

test('untraced instructions are marked as such', () => {
    const traced = script.decodeInstruction(romWith([0xa7, 0x0f]), AT, new script.OperandStack());
    const guessed = script.decodeInstruction(romWith([0x26]), AT, new script.OperandStack());
    assert.strictEqual(traced.untraced, false);
    assert.strictEqual(guessed.untraced, true, '0x26 has a known length but an unverified meaning');
});

// ── loot ────────────────────────────────────────────────────────────────────

// $2391 LOOT_ITEM, $2395 LOOT_OBJECT, $2461 LOOT_AMOUNT. Offsets are from
// the $2258 base the write opcodes index against.
const WRITE_ITEM = (v) => [0x18, 0x39, 0x01, 0x84, v & 0xff, v >> 8];
const WRITE_OBJECT = (v) => [0x17, 0x3d, 0x01, v & 0xff, v >> 8];
const WRITE_AMOUNT = (v) => [0x18, 0x09, 0x02, 0x84, v & 0xff, v >> 8];
const CALL_SNIFF = [0xa3, 0x39];
const CALL_GOURD = [0xa3, 0x3a];
const END = [0x00];

function loot(bytes) {
    const res = script.decodeScript(romWith(bytes), AT);
    return script.extractLoot(res.instructions);
}

test('a pickup is read from the values it writes down', () => {
    // The shape every sniff spot in the ROM has, and nothing is executed to
    // find it: the item, the object and the bonus are literals in the script.
    const f = loot([].concat(WRITE_ITEM(0x0206), WRITE_OBJECT(0x16), CALL_SNIFF, WRITE_AMOUNT(4), END));
    assert.strictEqual(f.kind, 'sniff');
    assert.strictEqual(f.item.value, 0x0206);
    assert.strictEqual(f.itemName, 'MUSHROOM');
    assert.strictEqual(f.objectId, 0x16);
    assert.strictEqual(f.amount, 1, 'no amount write means one of them');
    assert.strictEqual(f.next, 4);
});

test('$2461 means amount before the loot call and bonus after it', () => {
    // Same address, two meanings, told apart only by position — which is why
    // the extractor tracks where the call happened.
    const f = loot([].concat(
        WRITE_ITEM(0x0206), WRITE_OBJECT(0x16), WRITE_AMOUNT(2), CALL_SNIFF, WRITE_AMOUNT(4), END));
    assert.strictEqual(f.amount, 3, 'the pre-call write holds amount - 1');
    assert.strictEqual(f.next, 4);
});

test('the loot call says whether it is a sniff spot or a chest', () => {
    const base = [].concat(WRITE_ITEM(0x0200), WRITE_OBJECT(0x02));
    assert.strictEqual(loot(base.concat(CALL_SNIFF, END)).kind, 'sniff');
    assert.strictEqual(loot(base.concat(CALL_GOURD, END)).kind, 'gourd');
    assert.strictEqual(loot(base.concat(END)).kind, null, 'no call, no pickup');
});

test('a pickup round-trips into Everscript the compiler accepts', () => {
    const sniff = loot([].concat(WRITE_ITEM(0x0206), WRITE_OBJECT(0x16), CALL_SNIFF, WRITE_AMOUNT(4), END));
    assert.strictEqual(script.lootToEverscript(sniff), '_loot(0x16, MUSHROOM, 0d01, 0d04);');
    // _loot_chest defaults its tail arguments, so zeroes are dropped.
    const chest = loot([].concat(WRITE_ITEM(0x0200), WRITE_OBJECT(0x02), CALL_GOURD, END));
    assert.strictEqual(script.lootToEverscript(chest), '_loot_chest(0x02, WAX, 0d01);');
});

test('a pickup with no exact Everscript form produces none', () => {
    // An item id outside LOOT_REWARD cannot be written back by name, and a
    // guess would compile into a different item.
    const f = loot([].concat(WRITE_ITEM(0x0fff), WRITE_OBJECT(0x01), CALL_SNIFF, END));
    assert.strictEqual(f.itemName, null);
    assert.strictEqual(script.lootToEverscript(f), null);
});

// ── branch following ────────────────────────────────────────────────────────

test('the walk resumes at a branch target instead of ending at the first END', () => {
    // SKIP 3 over an END, to code only the branch can reach. A linear reader
    // stops at byte 3 and reports a three-byte script.
    const res = script.decodeScript(romWith([0x04, 0x03, 0x00, 0x00, 0x00, 0x00, 0xa7, 0x0f, 0x00]), AT);
    assert.strictEqual(res.stopReason, 'terminated');
    assert.deepStrictEqual(res.instructions.map((i) => i.summary), [
        'SKIP 3 (to 0x928006)', 'END (return)', 'SLEEP 14 TICKS', 'END (return)',
    ]);
});

test('an undecodable byte is recorded and the walk carries on', () => {
    // 0x01 has no decoding, but the branch target is still reachable.
    const res = script.decodeScript(romWith([0x04, 0x03, 0x00, 0x01, 0x00, 0x00, 0xa7, 0x0f, 0x00]), AT);
    assert.deepStrictEqual(res.gaps, [AT + 3]);
    assert.strictEqual(res.stopReason, 'terminated');
    assert.ok(res.instructions.some((i) => i.undecodable));
    assert.ok(res.instructions.some((i) => i.summary === 'SLEEP 14 TICKS'), 'kept going past the gap');
});

// ── room script discovery ───────────────────────────────────────────────────

test('a room model finds its trigger tables and decodes what they point at', () => {
    const rom = new Uint8Array(0x400000);
    const put = (snes, bytes) => rom.set(bytes, script.snesToRom(snes));
    // Room 0's data blob, and the step-on table inside it.
    put(0x9ffde7, [0x00, 0x01, 0x00]);           // blob at 0x000100
    rom.set([0x06, 0x00], 0x100 + 0x0d);         // step table: one 6-byte entry
    rom.set([0x0f, 0x27, 0x10, 0x28, 0x00, 0x00], 0x10f);  // y1,x1,y2,x2,id
    rom.set([0x00, 0x00], 0x115);                // no B-triggers
    // Script pointer table, and the script both pointers resolve to.
    put(0x928000, [0x10, 0x00]);
    put(0x928010, [0x00, 0x02, 0x00]);
    put(0x92801b, [0x00, 0x02, 0x00]);
    put(0x928200, [0xa7, 0x0f, 0x00]);

    const m = script.buildRoomScriptModel(rom, 0);
    assert.strictEqual(m.stepOn.length, 1);
    assert.strictEqual(m.bTrigger.length, 0);
    const t = m.stepOn[0];
    assert.deepStrictEqual([t.x1, t.y1, t.x2, t.y2], [0x27, 0x0f, 0x28, 0x10]);
    assert.strictEqual(t.scriptAddressSnes, 0x928200);
    assert.strictEqual(t.terminated, true);
    assert.deepStrictEqual(t.instructions.map((r) => r.summary), ['SLEEP 14 TICKS', 'END (return)']);
    assert.strictEqual(m.enter.label, 'SLEEP 14 TICKS');
});

test('a script that runs into an undecodable opcode says so in a final row', () => {
    const rom = new Uint8Array(0x400000);
    rom.set([0xa7, 0x0f, 0x01], script.snesToRom(0x928200));
    rom.set([0x10, 0x00], script.snesToRom(0x928000));
    rom.set([0x00, 0x02, 0x00], script.snesToRom(0x92801b));
    rom.set([0x00, 0x01, 0x00], script.snesToRom(0x9ffde7));
    const m = script.buildRoomScriptModel(rom, 0);
    const rows = m.enter.instructions;
    assert.strictEqual(m.enter.terminated, false);
    assert.strictEqual(m.enter.stopReason, 'unknown-opcode');
    assert.strictEqual(rows[rows.length - 1].unsupported, true);
    assert.ok(/UNKNOWN INSTR/.test(rows[rows.length - 1].summary));
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
