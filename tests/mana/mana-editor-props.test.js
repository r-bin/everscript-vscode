// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The Mana editor's cell properties and solver (src/games/mana/maps/webview/editor-props.js) on a made-up map: what a
// cell's bytes mean, and how a drawn wish becomes a metatile — reused, copied into a free slot, or "?" when no
// slot is free, the metatile is a step event, or the 8 px drawing has no Mana shape. No DOM, no ROM.
// Run: node tests/mana/mana-editor-props.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The two files are plain browser scripts sharing globals: run them in one context, as the page does.
const DIR = path.join(__dirname, '..', '..', 'src', 'games', 'mana', 'maps', 'webview');
const ctx = { module: undefined };
vm.createContext(ctx);
['editor-model.js', 'editor-props.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx, { filename: f }));
const P = ctx;

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

/** 4x1 map: cells show metatiles 1, 1, 2, $BF; 1 is a level-2 floor, 2 a bush cut into 3, $BF a step-event metatile (lead 1). */
function model(extraUsed) {
    const coll = new Array(768).fill(0);
    coll[4] = 2; coll[8] = 2; coll[10] = 0xC1; coll[11] = 3; coll[0xBF * 4] = 2;
    const a = [1, 1, 2, 0xBF].concat(extraUsed || []);
    return P.manaEdModel({ id: 1, w: a.length, h: 1, sizeB: null, a, b: [], collision: { a: coll, b: new Array(768).fill(0) },
        backdrop: [0, 0, 0], lead: 1, events: { onEnter: null, steps: [] }, objects: [], pieces: [] });
}

console.log('\nMana editor: cell properties and the solver:');

test('bytes read as properties: shapes, levels, stairs, push, cut, strike', () => {
    assert.strictEqual(P.manaEdShapeOf([3, 0, 0, 0]), 'wall');
    assert.strictEqual(P.manaEdShapeOf([0, 0, 0x16, 0]), 6);
    assert.strictEqual(P.manaEdShapeOf([2, 0, 0x21, 0]), 'open');
    assert.strictEqual(P.manaEdLevelOf([0x15, 0, 0, 0]), 5);
    assert.strictEqual(P.manaEdEffectOf([0, 0, 0x21, 0]).kind, 'stairs');
    const push = P.manaEdEffectOf([0, 0, 0x32, 0]);
    assert.deepStrictEqual([push.kind, push.dir, push.speed], ['push', 2, 1]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(P.manaEdEffectOf([0, 0, 0xC1, 0x5F]))), { kind: 'cut', n: 1, to: 0x5F });
    assert.strictEqual(P.manaEdEffectOf([0, 0, 0xF8, 0x6F]).event, 0x6F8);
});

test('8 px quarters: none open, four a wall, an L of three a half wall; a side or a lone corner is no Mana shape', () => {
    assert.strictEqual(P.manaEdShapeOfQuarters(0), 'open');
    assert.strictEqual(P.manaEdShapeOfQuarters(15), 'wall');
    assert.strictEqual(P.manaEdShapeOfQuarters(1 | 4 | 8), 4);
    assert.strictEqual(P.manaEdShapeOfQuarters(1 | 2), null);
    assert.strictEqual(P.manaEdShapeOfQuarters(1), null);
    for (const d of [4, 5, 6, 7]) assert.strictEqual(P.manaEdShapeOfQuarters(P.manaEdQuartersOf(d)), d);
});

test('a wished wall copies the metatile into the first free slot; a second cell with the same wish reuses it', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 0, 'coll', { shape: 'wall', level: null });
    P.manaEdSetWish(m, 'A', 1, 'coll', { shape: 'wall', level: null });
    const s = P.manaEdSolve(m, 'A');
    assert.strictEqual(s.copies.length, 1);
    assert.strictEqual(s.copies[0].pic, 1, 'the copy draws metatile 1’s picture');
    const slot = s.copies[0].slot;
    assert.ok(![0, 1, 2, 3, 0xBF].includes(slot), 'not a slot the map uses, nor the bush’s cut result: ' + slot);
    assert.strictEqual(P.manaEdCellMetatile(m, 'A', 0, 0), slot);
    assert.strictEqual(P.manaEdCellMetatile(m, 'A', 1, 0), slot);
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 0, 0)), [3, 0, 0, 0]);
    assert.strictEqual(P.manaEdCell(m, 'A', 0, 0), 1, 'the picture choice stays metatile 1');
});

test('a copy keeps every byte it was not asked to change; the last wish on c2 wins (a half wall takes a bush’s cut)', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 2, 'sw', { on: true });
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 2, 0)), [2 | 8, 0, 0xC1, 3], 'layer switch added, the cut kept');
    P.manaEdSetWish(m, 'A', 2, 'coll', { shape: 5, level: null });
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 2, 0)), [2 | 8, 0, 0x15, 0], 'the half wall took c2 and c3');
    P.manaEdSetWish(m, 'A', 2, 'eff', { c2: 0x21 });
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 2, 0)), [2 | 8, 0, 0x21, 0], 'drawn after it, stairs take c2 back');
});

test('the cut result stays in use: copies never land on it', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 0, 'coll', { shape: 'wall', level: null });
    assert.notStrictEqual(P.manaEdSolve(m, 'A').copies[0].slot, 3);
});

test('a step-event metatile is never copied: the cell is marked and keeps its own', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 3, 'coll', { shape: 'wall', level: null });
    const c = P.manaEdSolve(m, 'A').cells[3];
    assert.ok(c.unfit && /step event/.test(c.why));
    assert.strictEqual(P.manaEdCellMetatile(m, 'A', 3, 0), 0xBF);
});

test('8 px squares with no Mana shape mark the cell and change nothing', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 0, 'coll', { quarters: 1 | 2, level: null });
    const c = P.manaEdSolve(m, 'A').cells[0];
    assert.ok(c.unfit);
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 0, 0)), [2, 0, 0, 0]);
});

test('no free slot left: the cell is marked, nothing rounded', () => {
    const all = [];
    for (let n = 4; n < 0xBF; n++) all.push(n);
    const m = model(all);
    P.manaEdSetWish(m, 'A', 0, 'coll', { shape: 'wall', level: null });
    assert.ok(/no free metatile/.test(P.manaEdSolve(m, 'A').cells[0].why));
});

test('undo and redo of a wish go through the model’s apply', () => {
    const m = model();
    const ch = P.manaEdSetWish(m, 'A', 0, 'coll', { shape: 'wall', level: null });
    P.manaEdApply(m, ch, 'before');
    assert.strictEqual(P.manaEdCellMetatile(m, 'A', 0, 0), 1);
    P.manaEdApply(m, ch, 'after');
    assert.deepStrictEqual(Array.from(P.manaEdCellBytes(m, 'A', 0, 0)), [3, 0, 0, 0]);
    assert.strictEqual(P.manaEdSetWish(m, 'A', 0, 'coll', { shape: 'wall', level: null }), null, 'the same wish again changes nothing');
});

test('step on / walk into is c1 bit 6', () => {
    const m = model();
    P.manaEdSetWish(m, 'A', 1, 'walk', { on: true });
    assert.strictEqual(P.manaEdCellBytes(m, 'A', 1, 0)[1] & 0x40, 0x40);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
