// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Playing a step against one WRAM (simulation/play.ts) and the combat model (simulation/combat/),
// without a ROM: hand-built trigger cases and fighters. The ROM side (records, animations, the hit
// table) is checked in tests/memory/routes-tab.test.js; the model against the game itself with
// tools/routes/fight-in-game.mts (docs/entities/combat.md).

const assert = require('assert');
const { playStep, freshState, holds } = require('../../dist/games/evermore/simulation');
const { damageTable, simulateFight, bestCase } = require('../../dist/games/evermore/simulation/combat');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); failed++; }
}

(async () => {
    console.log('\nSimulation — play and combat');
    // A gourd as the simulation reports it: taken flag $2268 bit 6, Petal count byte $2315 < 6, the Boy in control.
    const bit = (addr, b) => ({ k: 'bit', a: { k: 'mem', addr, size: 1 }, bit: b });
    const gourd = {
        cases: [{ label: '1 × PETAL', when: [], mapId: null, loot: { itemName: 'PETAL', object: 0, looted: true, amount: { k: 'c', v: 1 }, slot: 0x2315, flagsSet: [{ addr: 0x2268, bit: 6 }] } }],
        always: [
            { cond: bit(0x2268, 6), value: false, text: 'not Gourd in south Jungle [$2268&0x40]' },
            { cond: { k: 'bin', op: '==', a: { k: 'ent', label: 'boy' }, b: { k: 'atom', name: 'controlled char' } }, value: true, text: 'the boy is in control' },
            { cond: { k: 'bin', op: '<', a: { k: 'mem', addr: 0x2315, size: 1 }, b: { k: 'c', v: 6 } }, value: true, text: '($2315.b < 6)' },
        ],
        otherwise: [{ when: [], note: 'nothing staged' }],
    };
    await test('a gourd: Petal in its byte, taken flag set, object opened; looting again does nothing', () => {
        const r = playStep({ room: 0x38, at: 'b1', who: 'Boy' }, freshState(0x38), gourd);
        assert.strictEqual(r.verdict, 'ok');
        assert.deepStrictEqual(r.state.items, { PETAL: 1 });
        assert.strictEqual(r.state.wram[0x2315], 1);
        assert.strictEqual(r.state.wram[0x2268], 0x40);
        assert.deepStrictEqual(r.state.opened, { 0x38: [0] });
        assert.strictEqual(r.state.flags[0].name, 'Gourd in south Jungle [$2268&0x40]');
        const again = playStep({ room: 0x38, at: 'b1', who: 'Boy' }, r.state, gourd);
        assert.strictEqual(again.verdict, 'missing');
        assert.deepStrictEqual(again.state.items, { PETAL: 1 });
        assert.strictEqual(playStep({ room: 0x38, at: 'b1', who: 'Dog' }, freshState(0x38), gourd).verdict, 'missing', 'the dog gets nothing');
        assert.strictEqual(playStep({ room: 0x38, at: 'b1', talons: 10 }, freshState(0x38), gourd).verdict, 'differs');
        assert.strictEqual(holds(bit(0x2268, 6), r.state, 'boy'), true);
    });
    await test('an exit by a flag; a move no script makes; no ROM', () => {
        const exit = { cases: [
            { label: 'change map to 0x5c', when: [{ cond: bit(0x225f, 6), value: false, text: 'not raptors' }], mapId: 0x5c, loot: null },
            { label: 'change map to 0x25', when: [{ cond: bit(0x225f, 6), value: true, text: 'raptors' }], mapId: 0x25, loot: null },
        ], always: [], otherwise: [] };
        assert.strictEqual(playStep({ room: 0x38, at: 'step0', to: 0x5c }, freshState(0x38), exit).state.room, 0x5c);
        const fought = Object.assign(freshState(0x38), { wram: { [0x225f]: 0x40 } });
        assert.strictEqual(playStep({ room: 0x38, at: 'step0', to: 0x5c }, fought, exit).verdict, 'differs');
        assert.strictEqual(playStep({ room: 0x51 }, freshState(0x5c)).verdict, 'missing');
        assert.strictEqual(playStep({ room: 0x38, at: 'b1' }, freshState(0x38), undefined).verdict, 'none');
    });
    // Two attackers on one target, fixed timings: the shape the flower fight has.
    const fighter = (o) => Object.assign({ name: 'x', hp: 18, atk: 17, def: 28, evade: 0, hitRate: 99, chargeSpeed: 10, chance: null, swing: { ticks: 24, strikeAt: 5 }, knockback: { ticks: 1, random: { base: 40, range: 40 } } }, o);
    await test('fight model: the damage roll, the best case, reproducible runs', () => {
        const t = damageTable(17, 28);
        assert.deepStrictEqual([Math.min(...t), Math.max(...t)], [7, 12], 'w = 17 - 28/4 = 10');
        assert.deepStrictEqual([Math.min(...damageTable(9, 5)), Math.max(...damageTable(9, 5))], [6, 10]);
        assert.deepStrictEqual([Math.min(...damageTable(1, 28)), Math.max(...damageTable(1, 28))], [0, 1], 'clamped to w = 1');
        const enemy = fighter({ name: 'flower', atk: 9, def: 28, chance: 5, chargeSpeed: 15, swing: { ticks: 34, strikeAt: 6 } });
        const setup = { enemy, party: [{ f: fighter({ name: 'Boy', def: 5, evade: 34 }), attacks: true }, { f: fighter({ name: 'Dog', chance: 255, swing: { ticks: 33, strikeAt: 12 } }), attacks: true }], until: 'enemy', hitChance: () => 1 };
        assert.strictEqual(bestCase(setup), 13, 'both strike once, 12 + 12 ≥ 18, the later strike at tick 12');
        const a = simulateFight(setup, 500, 7), b = simulateFight(setup, 500, 7);
        assert.deepStrictEqual(a, b);
        assert.ok(a.seconds.stats.min >= bestCase(setup) / 60);
        const death = simulateFight({ enemy, party: [{ f: fighter({ name: 'Boy', hp: 30, def: 5 }), attacks: false }], until: 'party', hitChance: () => 1 }, 500, 7);
        assert.deepStrictEqual(death.hits.map((h) => h[0]).filter((h) => h < 3 || h > 5), [], '30 HP at 6-10 a hit: 3 to 5 hits');
    });
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
