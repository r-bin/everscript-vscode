'use strict';
// Rooms, simulated: Fire Eyes' Village checked against what is known about it
// (the sibling everscript repo's hand-written room analysis lists the same
// exits, pickups, NPC conditions and cutscenes), and a sweep over every room
// that requires the operand layout to agree with the decoder everywhere the
// simulation executed an instruction.
//
// Skips without the Evermore ROM in the ROM library.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sim = require('../../dist/games/evermore/simulation');

const ROM = require('../../dist/games').romPath('evermore');
if (!fs.existsSync(ROM)) { console.log('SKIP simulation room: no ROM'); process.exit(0); }
const rom = new Uint8Array(fs.readFileSync(ROM));

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

const DEBUG_OFF = { addr: 0x22eb, bit: 3, value: 0, why: 'debug mode off' };
const S = sim.createSimulator(rom);
const fe = S.room(0x25, [...sim.PINS_BETWEEN_PICKUPS, DEBUG_OFF]);

/** Every condition the flag tree branches on, by key. */
function treeConds(n, out = new Set()) {
    if (n.cond) { out.add(sim.key(n.cond.cond)); treeConds(n.then, out); treeConds(n.else, out); }
    return out;
}

test("Fire Eyes' Village: scenarios split on credits, outro, the windwalker and the Thraxx nudge", () => {
    const conds = treeConds(fe.flags);
    for (const k of ['$22f2&0x01', '$22f1&0x40', '($22ec&0x20 && !($22dc&0x08))']) {
        assert.ok(conds.has(k), `missing ${k} in ${[...conds].join(', ')}`);
    }
    // The nudge has one side only: "not nudged" ends the same way as "nudged already
    // this session" ($245f), so those merged; the scenarios that show it carry it.
    assert.ok(fe.scenarios.some((s) => s.when.some((w) => sim.key(w.cond) === '($2260&0x10 && !($225f&0x80))' && w.value)));
    assert.ok(!fe.capped);
    assert.ok(fe.scenarios.length >= 5 && fe.scenarios.length <= 32, `${fe.scenarios.length} scenarios`);
});

const plain = fe.scenarios.find((s) => s.when.every((w) => !w.value));

test('the default scenario places the villagers before the fade-in and runs the walk-in after', () => {
    assert.ok(plain, 'a scenario with every tested flag clear');
    const npcs = plain.prepare.filter((p) => p.kind === 'npc');
    assert.ok(npcs.length >= 10, `${npcs.length} NPC parts`);
    assert.ok(plain.prepare.some((p) => p.kind === 'objects'), 'object states are prepared');
    assert.ok(plain.execute.length > 0, 'something runs once the screen is visible');
});

test('NPCs are followed through RAM, with the flags that place them', () => {
    const boy = plain.entities.find((e) => e.refs.includes(0x2853));
    assert.ok(boy && /^Boy#/.test(boy.label), 'the bee boy is stored in $2853');
    const fireEyes = plain.entities.find((e) => /^Fire Eyes#cf5b/.test(e.label));
    assert.ok(fireEyes, 'Fire Eyes can be placed');
    assert.strictEqual(fireEyes.whenText, '$22ec&0x20');
    assert.ok(fireEyes.refs.includes(0x2835));
    const guard = plain.entities.find((e) => /^Old man#cf4d/.test(e.label));
    assert.ok(guard && /\$2260&0x10/.test(guard.whenText) && /\$2288&0x08/.test(guard.whenText), guard && guard.whenText);
});

test('triggers cluster into 20 pickups and 12 exits, and the pickups are prepared by the enter script', () => {
    const loot = fe.clusters.find((c) => c.kind === 'loot');
    const exits = fe.clusters.find((c) => c.kind === 'transition');
    assert.strictEqual(loot.triggers.length, 20);
    assert.strictEqual(exits.triggers.length, 12);
    // 17 permanent pickups are hidden by the flag their own B-trigger sets.
    assert.strictEqual(loot.preparedBy.length, 17);
    assert.ok(loot.preparedBy.some((p) => p.object === 0 && p.flag === '$2269&0x10'), 'the wax gourd');
});

test('the north exit is gated on the Thraxx nudge', () => {
    const north = fe.triggers.find((t) => t.type === 'step-on' && t.analysis.cases.some((c) => c.mapId === 0x41));
    assert.ok(north);
    assert.ok(north.analysis.always.some((w) => sim.key(w.cond) === '($2260&0x10 && !($225f&0x80))' && !w.value));
});

test('the report renders', () => {
    const md = sim.roomReport(fe);
    assert.ok(md.includes('## Flag tree') && md.includes('**Prepare**') && md.includes('### loot: 20 pickups'));
});

test('every room script runs through the simulation, and the operand layout agrees with the decoder everywhere', () => {
    // Small budgets: this checks that every reachable instruction is executed with the
    // right layout, not the analysis itself (tools/simulation/sweep-rooms.js does that).
    const all = sim.createSimulator(rom);
    const { buildRoomScriptModel } = require('../../dist/games/evermore/script-model');
    let scripts = 0;
    for (let id = 0; id < 0x7f; id++) {
        const m = buildRoomScriptModel(rom, id);
        for (const t of [m.enter, ...m.stepOn, ...m.bTrigger]) {
            all.run(t.scriptAddressSnes, { maxSteps: 4000, maxTicks: 60, maxPaths: 64, rejoin: true, abstractVisual: true });
            scripts++;
        }
    }
    const errors = [...all.machine.layoutErrors.entries()].map(([a, e]) => `${a.toString(16)} op ${e.opcode.toString(16)} ${e.ours}/${e.decoder}`);
    console.log(`    ${scripts} scripts run`);
    assert.deepStrictEqual(errors, []);
});

console.log(`\nsimulation room: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
