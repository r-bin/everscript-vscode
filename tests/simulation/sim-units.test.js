'use strict';
// Unit tests for the script simulation, without a ROM: hand-assembled scripts
// in an otherwise empty buffer. The ROM tests (loot, rooms, operand layout)
// prove the simulation on the real game; these pin the individual rules —
// operand evaluation, forking, pins, rejoining — so a regression is named.

const assert = require('assert');
const script = require('../../src/games/evermore/script');
const sim = require('../../src/games/evermore/simulation');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

const AT = 0x948000;
function simWith(bytes) {
    const rom = new Uint8Array(0x400000);
    rom.set(bytes, script.snesToRom(AT));
    return sim.createSimulator(rom);
}
const finalOf = (path, addr) => (path.diff.find((d) => d.addr === addr) || {}).value;

// IF $2259&0x01 { $2391 = 0x0807 } ; END
// 0x09 jumps past the body when the condition is false. Flag operand 0x0008 is
// byte offset 1 from $2258, bit 0.
const IF_FLAG = [0x09, 0x85, 0x08, 0x00, 0x06, 0x00, 0x18, 0x39, 0x01, 0x84, 0x07, 0x08, 0x00];

// ── operands ────────────────────────────────────────────────────────────────

test('a terminated inline constant is the whole operand', () => {
    const r = simWith([0x18, 0x39, 0x01, 0xb3, 0x00]).run(AT);
    assert.strictEqual(r.paths.length, 1);
    assert.strictEqual(sim.key(finalOf(r.paths[0], 0x2391)), '3');
});

test('push and a binary operator: pulled + res', () => {
    // 1, push, 2, + (terminating)
    const r = simWith([0x18, 0x39, 0x01, 0x31, 0x29, 0x32, 0x9a, 0x00]).run(AT);
    assert.strictEqual(sim.key(finalOf(r.paths[0], 0x2391)), '3');
});

test('reading memory nobody wrote stays symbolic and counts up', () => {
    // $2391 = word $2393 + 1   (0x09 = read word, offset 0x013b)
    const r = simWith([0x18, 0x39, 0x01, 0x09, 0x3b, 0x01, 0x29, 0x31, 0x9a, 0x00]).run(AT);
    assert.strictEqual(sim.key(finalOf(r.paths[0], 0x2391)), '($2393 + 1)');
});

test('the operand layout agrees with the decoder on every executed instruction', () => {
    const s = simWith(IF_FLAG);
    s.run(AT);
    assert.strictEqual(s.machine.layoutErrors.size, 0);
});

// ── forks, pins, merges ─────────────────────────────────────────────────────

test('an unknown flag forks the script into both outcomes', () => {
    const r = simWith(IF_FLAG).run(AT);
    assert.strictEqual(r.paths.length, 2);
    const taken = r.paths.find((p) => p.assumptions[0].value);
    const skipped = r.paths.find((p) => !p.assumptions[0].value);
    assert.strictEqual(sim.key(taken.assumptions[0].cond), '$2259&0x01');
    assert.strictEqual(sim.key(finalOf(taken, 0x2391)), '0x0807');
    assert.strictEqual(finalOf(skipped, 0x2391), undefined, 'the other side writes nothing');
});

test('a pinned flag decides the fork instead', () => {
    const r = simWith(IF_FLAG).run(AT, { pins: [{ addr: 0x2259, bit: 0, value: 1 }] });
    assert.strictEqual(r.paths.length, 1);
    assert.strictEqual(r.paths[0].assumptions.length, 0, 'nothing was assumed');
    assert.strictEqual(sim.key(finalOf(r.paths[0], 0x2391)), '0x0807');
});

test('a second test of the same flag follows the first answer', () => {
    // IF flag { $2391 = 7 } ; IF flag { $2393 = 7 } ; END  — two paths, not four.
    const body = (lo) => [0x09, 0x85, 0x08, 0x00, 0x04, 0x00, 0x18, lo, 0x01, 0xb7];
    const r = simWith([...body(0x39), ...body(0x3b), 0x00]).run(AT);
    assert.strictEqual(r.paths.length, 2);
    for (const p of r.paths) {
        assert.strictEqual(!!finalOf(p, 0x2391), !!finalOf(p, 0x2393), 'both writes or neither');
    }
});

test('rejoining keeps one path and records the branch', () => {
    const r = simWith(IF_FLAG).run(AT, { rejoin: true });
    assert.strictEqual(r.paths.length, 1);
    const p = r.paths[0];
    assert.ok(p.steps.some((s) => s.kind === 'branch'), 'the if survives as a branch step');
    assert.strictEqual(sim.key(finalOf(p, 0x2391)), '($2259&0x01 ? 0x0807 : $2391)');
});

test('a flag write stores the bit, and a later test reads it back', () => {
    // $2259 |= 0x01 (0x0c, code 0x0008, value 1) ; IF flag { $2391 = 7 } ; END
    const r = simWith([0x0c, 0x08, 0x00, 0xb1, 0x09, 0x85, 0x08, 0x00, 0x04, 0x00, 0x18, 0x39, 0x01, 0xb7, 0x00]).run(AT);
    assert.strictEqual(r.paths.length, 1, 'decided by our own write');
    assert.strictEqual(sim.key(finalOf(r.paths[0], 0x2391)), '7');
});

// ── understanding ───────────────────────────────────────────────────────────

test('an increment is read as "+= n", a flag change as bits', () => {
    // $2318 = byte $2318 + 3 (0x14 byte write, 0x07 read byte, push, 3, '+' terminating) ; $2259 |= 1 ; END
    const r = simWith([0x14, 0xc0, 0x00, 0x07, 0xc0, 0x00, 0x29, 0x33, 0x9a, 0x0c, 0x08, 0x00, 0xb1, 0x00]).run(AT);
    const ch = sim.changes(r.paths[0]);
    assert.deepStrictEqual(ch.map((x) => x.kind), ['bits', 'add']);
    assert.strictEqual(sim.key(ch[1].amount), '3');
});

// ── time: the game's scheduler ($8C:CFFD) ──────────────────────────────────

/** Bytes at AT, more bytes at AT + 0x10. */
function simWith2(main, other) {
    const rom = new Uint8Array(0x400000);
    rom.set(main, script.snesToRom(AT));
    rom.set(other, script.snesToRom(AT + 0x10));
    return sim.createSimulator(rom);
}
/** The packed script pointer of AT + 0x10 ($948010 → 0x010010). */
const PTR = [0x10, 0x00, 0x01];

test('a started script (0x07) runs in the same tick, after its starter\'s turn', () => {
    // main: start other; $2391 = 1; END     other: $2393 = 2; END
    const S = simWith2([0x07, ...PTR, 0x18, 0x39, 0x01, 0xb1, 0x00], [0x18, 0x3b, 0x01, 0xb2, 0x00]);
    const p = S.run(AT, { log: true }).paths[0];
    assert.deepStrictEqual(p.log.map(([t, slot, pc]) => [t, slot.toString(16), (pc - AT).toString(16)]),
        [[0, '28fc', '0'], [0, '28fc', '4'], [0, '28fc', '8'], [0, '294b', '10'], [0, '294b', '14']]);
});

test('SLEEP n wakes max(1, n-1) ticks later; n = 0 does not pause', () => {
    for (const [n, tick] of [[0, 0], [1, 1], [2, 1], [5, 4]]) {
        const p = simWith([0xa7, n, 0x18, 0x39, 0x01, 0xb1, 0x00]).run(AT, { log: true }).paths[0];
        assert.strictEqual(p.log[1][0], tick, `SLEEP ${n}`);
    }
});

test('YIELD ends the turn for exactly one tick; a call costs none', () => {
    // main: YIELD; RCALL-free: CALL other (0x29); END     other: END
    const p = simWith2([0x3a, 0x29, ...PTR, 0x00], [0x00]).run(AT, { log: true }).paths[0];
    assert.deepStrictEqual(p.log.map(([t]) => t), [0, 1, 1, 1]);
});

console.log(`\nsim-units: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
