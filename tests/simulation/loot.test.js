'use strict';
// Loot, understood by simulation: run each pickup through the game's own loot
// scripts and read what changed in WRAM. Two kinds of check:
//
//  - the cases the user asked for: the Thraxx gourd in the village huts gives
//    Call Beads or a Biscuit depending on Thraxx, and the Quick Sand Desert
//    gourd adds 4 crystals (the largest crystal pickup in the game);
//  - every pickup in the ROM: the item and amount the simulation sees counted
//    up in the inventory must equal what src/games/evermore/script-model/loot.ts reads from the
//    literal writes (itself verified line for line against sniffflags.inc).
//    The two methods share nothing but the instruction boundaries.
//
// Skips without the Evermore ROM in the ROM library.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildRoomScriptModel } = require('../../src/games/evermore/script-model');
const sim = require('../../src/games/evermore/simulation');

const ROM = require('../../dist/games').romPath('evermore');
if (!fs.existsSync(ROM)) { console.log('SKIP simulation loot: no ROM'); process.exit(0); }
const rom = new Uint8Array(fs.readFileSync(ROM));
const S = sim.createSimulator(rom);

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
const text = (c) => c.when.map((w) => w.text).join(' & ');

test('the village-huts gourd: Call Beads if Thraxx is dead, a Biscuit otherwise', () => {
    const a = S.analyze(0x94e0ed);
    assert.strictEqual(a.kind, 'loot');
    assert.strictEqual(a.cases.length, 2, a.cases.map((c) => c.label).join(', '));
    const beads = a.cases.find((c) => c.label === '1 × CALL_BEADS');
    const biscuit = a.cases.find((c) => c.label === '1 × BISCUIT');
    assert.ok(beads && biscuit);
    assert.ok(beads.when.some((w) => sim.key(w.cond) === '$2260&0x10' && w.value), text(beads));
    assert.ok(biscuit.when.some((w) => sim.key(w.cond) === '$2260&0x10' && !w.value), text(biscuit));
    // The inventory slots come from watching the global loot script count up.
    assert.strictEqual(beads.loot.slot, 0x231c);
    assert.strictEqual(biscuit.loot.slot, 0x2318);
    // Both set the gourd's own "taken" flag.
    for (const c of [beads, biscuit]) assert.deepStrictEqual(c.loot.flagsSet, [{ addr: 0x2266, bit: 7 }]);
    // Already taken: nothing staged at all.
    assert.ok(a.otherwise.some((o) => o.note === 'nothing staged' && o.when.some((w) => sim.key(w.cond) === '$2266&0x80' && w.value)));
});

test('the Quick Sand Desert gourd adds 4 crystals to $230e', () => {
    const a = S.analyze(0x9396a9);
    assert.strictEqual(a.cases.length, 1);
    assert.strictEqual(a.cases[0].label, '4 × CRYSTAL');
    assert.strictEqual(a.cases[0].loot.slot, 0x230e);
});

test('without the between-pickups assumption the bonus stays visible', () => {
    // $2461 is the leftover bonus; with no pin the amount depends on it.
    const a = S.analyze(0x94e0ed, []);
    assert.ok(a.cases.some((c) => /\$2461/.test(c.label)), a.cases.map((c) => c.label).join(', '));
});

test('Ebon Keep: a bonus staged on one path does not leak into the other', () => {
    // $98CCCC: the Vinegar branch writes $2461 = 2 and ENDs; the Biscuit branch
    // is another path. The decoder's linear walk carries the bonus across the
    // END and reports 3 Biscuits; the game gives 1 Biscuit and 3 Vinegar.
    const labels = S.analyze(0x98cccc).cases.map((c) => c.label).sort();
    assert.deepStrictEqual(labels, ['1 × BISCUIT', '3 × VINEGAR']);
});

/**
 * Scripts where the decoder's position-blind walk carries a `$2461` bonus from
 * one path into another (see the test above). The simulation is right there;
 * the decoder's amount is not, so they are left out of the agreement count.
 */
const DECODER_LEAKS = new Set([0x98cccc, 0x98cc8a, 0x98d194, 0x98cf0c]);

test('every pickup in the ROM: simulated loot equals the decoded loot', () => {
    let total = 0, agree = 0;
    const wrong = [];
    for (let id = 0; id < 0x7f; id++) {
        let room;
        try { room = buildRoomScriptModel(rom, id); } catch { continue; }
        for (const t of room.bTrigger) {
            const facts = t.loot.filter((l) => l.itemName && l.itemName !== 'MONEY' && l.item.value !== null);
            if (!facts.length || DECODER_LEAKS.has(t.scriptAddressSnes)) continue;
            const a = S.analyze(t.scriptAddressSnes);
            for (const f of facts) {
                total++;
                const label = `${f.amount} × ${f.itemName}`;
                if (a.cases.some((c) => c.label === label)) agree++;
                else wrong.push(`room 0x${id.toString(16)} ${t.scriptAddressSnes.toString(16)}: decoded ${label}, simulated ${a.cases.map((c) => c.label).join(' / ') || '(' + a.detail + (a.capped ? ', capped' : '') + ')'}`);
            }
        }
    }
    console.log(`    ${agree}/${total} item pickups agree`);
    if (wrong.length) console.log('    ' + wrong.slice(0, 12).join('\n    '));
    assert.ok(total > 300, `only ${total} pickups found`);
    assert.strictEqual(agree, total);
});

console.log(`\nsimulation loot: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
