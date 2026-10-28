// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The script VM decoder on the user's ROM, checked against the game only:
//  - goldens.json: every script instruction the interpreter ran in the intro, the attract demo
//    and 32 recorded play sessions (tools/script-vm/record-goldens.js), with where its pointer
//    went: each must decode, end where the game went on, or jump where it jumped;
//  - a static walk from every table that names scripts (rooms, triggers, the pointer table, the
//    header) reaches all of them and no opcode or sub-op the game has no handler for.
// Skips without the Evermore ROM in the ROM library.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const V = require('../../dist/games/evermore/script-vm');

const ROM = require('../../dist/games').romPath('evermore');
if (!fs.existsSync(ROM)) { console.log('SKIP script-vm rom: no ROM'); process.exit(0); }
let bytes = new Uint8Array(fs.readFileSync(ROM));
if (bytes.length % 1024 === 512) bytes = bytes.subarray(512);
const rom = new V.ScriptRom(bytes);

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
const hex = (a) => '$' + a.toString(16).padStart(6, '0');

console.log('script-vm on the ROM:');

const goldens = JSON.parse(fs.readFileSync(path.join(__dirname, 'goldens.json'), 'utf8'));

test(`every instruction the game ran decodes to where the game went on (${goldens.length} instructions)`, () => {
    const wrong = [];
    const opcodes = new Set();
    for (const [at, afters] of goldens) {
        let ins;
        try { ins = V.decodeAt(rom, at); } catch (e) { wrong.push(`${hex(at)}: ${e.message}`); continue; }
        opcodes.add(ins.opcode);
        // A call, a wait or a start leaves the pointer after the instruction (the thread resumes
        // there); the end of a script leaves it there too, or clears the bank byte.
        const ok = (a) => ['call', 'yield', 'start'].includes(ins.flow) ? a === ins.next
            : ins.flow === 'end' ? a === ins.next || (a >>> 16) === 0
                : V.successors(ins).includes(a);
        for (const a of afters) if (!ok(a)) wrong.push(`${hex(at)} op $${ins.opcode.toString(16)} (${ins.flow}): the game went to ${hex(a)}, we say ${V.successors(ins).map(hex).join(' / ') || 'nowhere'}`);
    }
    assert.deepStrictEqual(wrong.slice(0, 10), []);
    assert.ok(opcodes.size >= 85, `${opcodes.size} opcodes seen`);
});

test('a walk from every table the game names reaches every instruction it ran, and nothing it cannot run', () => {
    const entries = V.allEntries(rom);
    const w = V.walk(rom, entries);
    assert.deepStrictEqual([...w.errors].slice(0, 5).map(([a, m]) => `${hex(a)}: ${m}`), []);
    assert.ok(w.instructions.size > 60000, `${w.instructions.size} instructions`);
    const missed = goldens.filter(([at]) => !w.instructions.has(at)).map(([at]) => hex(at));
    assert.deepStrictEqual(missed.slice(0, 10), [], `${missed.length} instructions the game ran are not reached`);
});

test('room tables: enter scripts and triggers point into script space', () => {
    let rooms = 0, triggers = 0, none = 0;
    for (let r = 0; r < V.roomCount(rom); r++) {
        const s = V.roomScripts(rom, r);
        rooms++;
        if (s.enter === null) none++; else assert.ok(rom.contains(s.enter), `room ${r}: enter ${hex(s.enter)}`);
        for (const t of s.triggers) { triggers++; assert.ok(rom.contains(t.script), `room ${r}: trigger ${t.id}`); assert.ok(t.x1 <= t.x2 && t.y1 <= t.y2, `room ${r}: rectangle`); }
    }
    assert.ok(rooms === 127 && triggers > 900 && none < 5, `${rooms} rooms, ${triggers} triggers, ${none} without an enter script`);
});

test('parameters.json: one entry per opcode, one parameter per operand; entities get entities, the ROM agrees', () => {
    const FLOW = { r16: 'jump', rb: 'jump', u24: 'script', cb: 'script', c16: 'script', A: 'args', Z: 'list', skip: 'skip' };
    for (const [op, spec] of V.OPCODES) {
        const ps = V.parameters(op);
        assert.strictEqual(ps.length, spec.operands.length, `$${op.toString(16)}: ${ps.length} parameters for ${spec.operands.length} operands`);
        spec.operands.forEach((t, i) => {
            if (FLOW[t]) assert.strictEqual(ps[i].type, FLOW[t], `$${op.toString(16)} operand ${i}`);
            else if (t === 'u8' || t === 'u16') assert.strictEqual(ps[i].type, t, `$${op.toString(16)} operand ${i}`);
        });
    }
    // An entity parameter gets an entity sub-op, a read, or a small special value below $2000 (wait's 1 and 2, a room hook).
    const ENT = new Set(['last_entity', 'script_owner', 'boy', 'dog', 'camera_entity', 'other_character']);
    const w = V.walk(rom, V.allEntries(rom), true);
    let entities = 0;
    for (const ins of w.instructions.values()) {
        ins.operands.forEach((o, i) => {
            if (o.k !== 'E' || !V.isEntity(ins.opcode, i)) return;
            const n = V.tree(o.expr);
            if (n.k === 'value' && ENT.has(n.term.spec.name)) entities++;
            else if (n.k === 'const') assert.ok(n.value >= 0 && n.value < 0x2000, `$${ins.address.toString(16)}: constant ${n.value} as an entity`);
            else if (n.k === 'value') assert.fail(`$${ins.address.toString(16)}: ${n.term.spec.name}() as an entity`);
        });
    }
    assert.ok(entities > 4000, `${entities} entity sub-ops passed as entities`);
});

console.log(`\nscript-vm rom: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
