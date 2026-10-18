'use strict';
// The script model on the user's ROM: room listings, loot read per path, doors, arrivals.
// The expectations are game facts (knowledge ram/7e2391, ram/7e2461), not another tool's output.
// Skips without the Evermore ROM in the ROM library.

const assert = require('assert');
const fs = require('fs');
const M = require('../../src/games/evermore/script-model');
const V = require('../../src/games/evermore/script-vm');

const ROM = require('../../dist/games').romPath('evermore');
if (!fs.existsSync(ROM)) { console.log('SKIP script-model rom: no ROM'); process.exit(0); }
let bytes = new Uint8Array(fs.readFileSync(ROM));
if (bytes.length % 1024 === 512) bytes = bytes.subarray(512);
const rom = new V.ScriptRom(bytes);

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
const lootOf = (at) => M.scriptModel(rom, at).loot.map((l) => [l.itemName, l.amount]);

console.log('script-model on the ROM:');

const rooms = [];
for (let r = 0; r < 127; r++) rooms.push(M.buildRoomScriptModel(bytes, r));
const scripts = rooms.flatMap((m) => [m.enter, ...m.stepOn, ...m.bTrigger]);

test('every room builds; room 0x15 has no enter script; no listing reaches code the game cannot run', () => {
    assert.strictEqual(rooms[0x15].enter.stopReason, 'none');
    assert.strictEqual(rooms[0x15].enter.instructions.length, 0);
    const bad = scripts.filter((s) => s.instructions.some((i) => i.unsupported)).map((s) => s.scriptAddressSnes.toString(16));
    assert.deepStrictEqual(bad, []);
    assert.ok(scripts.every((s) => s.stopReason === 'none' || s.instructions.every((i) => i.summary)), 'every row has text');
});

test('a bonus staged on one branch does not reach the other ($98:CCCC: 3 Vinegar or 1 Biscuit)', () => {
    assert.deepStrictEqual(lootOf(0x98cccc), [['VINEGAR', 3], ['BISCUIT', 1]]);
});

test('the Thraxx gourd ($94:E0ED) gives Call Beads or a Biscuit, one pickup per branch', () => {
    assert.deepStrictEqual(lootOf(0x94e0ed), [['CALL_BEADS', 1], ['BISCUIT', 1]]);
});

test('pickups name their driver, object and reward; most write back as _loot / _loot_chest', () => {
    const loot = scripts.flatMap((s) => s.loot);
    assert.ok(loot.length > 900, `${loot.length} pickups`);
    assert.ok(loot.every((l) => l.kind === 'sniff' || l.kind === 'gourd'));
    const written = scripts.reduce((n, s) => n + s.everscript.length, 0);
    assert.ok(written > 0.95 * loot.length, `${written} of ${loot.length} written back`);
});

test('doors land inside the room table; arrivals index them by destination', () => {
    const doors = scripts.flatMap((s) => s.transitions);
    assert.ok(doors.length > 600, `${doors.length} doors`);
    assert.ok(doors.every((d) => d.mapId < 0x80 && d.x % 8 === 0 && d.y % 8 === 0));
    const arrivals = M.buildArrivalIndex(bytes);
    assert.ok(arrivals.size > 100, `${arrivals.size} rooms with a way in`);
});

console.log(`\nscript-model rom: ${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
