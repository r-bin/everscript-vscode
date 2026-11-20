// Open Evermore, the two steps of implode that can be tested apart (docs/open-evermore/tool.md §3):
// enum.mts (unordered names → ids through <kind>/_enum.json) and layout.mts (where the bytes go: stable, or
// shuffled by a seed). Synthetic data; no ROM, no dist/.
// Run: node tests/open-evermore/enum-layout.test.mts
import assert from 'node:assert';
import type { Item } from '../../tools/open-evermore/codec.mts';
import { resolveEnum } from '../../tools/open-evermore/enum.mts';
import { Findings } from '../../tools/open-evermore/findings.mts';
import { allocate, fitIn, normalise } from '../../tools/open-evermore/layout.mts';
import { json } from '../../tools/open-evermore/tree.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const ENUM = 'things/_enum.json';
const enumOf = (names: (string | null)[], limit = 8) => json({ kind: 'things', limit, why: 'test', names });
const resolve = (names: (string | null)[], present: string[], limit = 8) => {
    const f = new Findings();
    const ids = resolveEnum(ENUM, enumOf(names, limit), new Set(present), f);
    return { ids: ids && Object.fromEntries(ids), rules: f.list.map(x => x.rule) };
};

console.log('\nOpen Evermore — enum:');

test('the enum gives each listed name its position as id', () => {
    assert.deepStrictEqual(resolve(['b', 'a', 'c'], ['a', 'b', 'c']), { ids: { b: 0, a: 1, c: 2 }, rules: [] });
});

test('a new name gets the lowest free id (a gap first), with a warning', () => {
    assert.deepStrictEqual(resolve(['a', null, 'c'], ['a', 'c', 'z']), { ids: { a: 0, c: 2, z: 1 }, rules: ['unlocked-id'] });
});

test('new names are numbered in name order, not folder order', () => {
    assert.deepStrictEqual(resolve(['a'], ['a', 'y', 'x']).ids, { a: 0, x: 1, y: 2 });
});

test('a listed name without a resource is an error', () => {
    assert.deepStrictEqual(resolve(['a', 'gone'], ['a']).rules, ['locked-name-missing']);
});

test('past the limit is an error, with the reason', () => {
    assert.deepStrictEqual(resolve(['a', 'b'], ['a', 'b', 'c'], 2).rules, ['id-over-limit']);
});

test('bad and duplicate names are errors', () => {
    assert.deepStrictEqual(resolve(['Bad-Name', 'a', 'a'], ['a', 'Bad-Name']).rules, ['bad-name', 'duplicate-name', 'unlocked-id']);
});

test('a missing enum file is an error', () => {
    const f = new Findings();
    assert.strictEqual(resolveEnum(ENUM, undefined, new Set(['a']), f), null);
    assert.deepStrictEqual(f.list.map(x => x.rule), ['missing-file']);
});

console.log('\nOpen Evermore — layout:');

const item = (key: string, length: number): Item => ({ key, file: key, bytes: new Uint8Array(length), rule: { upperHalf: true, noCrossBank: true, maxSize: 0x8000 } });
// Two banks of rooms packed back to back in their upper halves, like Evermore's.
const items = [item('a', 0x3000), item('b', 0x2000), item('c', 0x3000), item('d', 0x4000), item('e', 0x1000), item('f', 0x2000)];
const at0: [string, number][] = [['a', 0x28000], ['b', 0x2B000], ['c', 0x2D000], ['d', 0x38000], ['e', 0x3C000], ['f', 0x3D000]];
const homes = new Map(at0.map(([k, at]) => [k, { at, length: items.find(i => i.key === k)!.bytes.length }]));
const pool = at0.map(([k, at]) => ({ start: at, end: at + homes.get(k)!.length }));

test('normalise merges adjacent spans and cuts them at banks', () => {
    assert.deepStrictEqual(normalise([{ start: 0x2B000, end: 0x2D000 }, { start: 0x28000, end: 0x2B000 }, { start: 0x2F000, end: 0x31000 }]),
        [{ start: 0x28000, end: 0x2D000 }, { start: 0x2F000, end: 0x30000 }, { start: 0x30000, end: 0x31000 }]);
});

test('fitIn keeps to the upper half and never crosses a bank', () => {
    const rule = { upperHalf: true, noCrossBank: true };
    assert.strictEqual(fitIn({ start: 0x20000, end: 0x40000 }, 0x1000, rule), 0x28000);
    assert.strictEqual(fitIn({ start: 0x2F800, end: 0x40000 }, 0x1000, rule), 0x38000);
    assert.strictEqual(fitIn({ start: 0x28000, end: 0x30000 }, 0x9000, rule), -1);
});

test('fitIn starts at or after `above`, and at `bankOffset` in some bank', () => {
    assert.strictEqual(fitIn({ start: 0x10000, end: 0x40000 }, 0x10, { above: 0x19000 }), 0x19000);
    const records = { bankOffset: 0xB678, upperHalf: true };
    assert.strictEqual(fitIn({ start: 0x2C000, end: 0x50000 }, 0x290C, records), 0x3B678);
    assert.strictEqual(fitIn({ start: 0x20000, end: 0x2C000 }, 0x290C, records), -1);
});

test('stable: every unchanged item stays at its home', () => {
    const l = allocate(items, pool, [], homes);
    assert.deepStrictEqual([...l.at].sort(), at0.sort());
    assert.strictEqual(l.moved, 0);
});

test('stable: an item that grew leaves its home for free space; the rest stay', () => {
    const grown = items.map(i => i.key === 'b' ? item('b', 0x2800) : i);
    const l = allocate(grown, pool, [{ start: 0x48000, end: 0x50000 }], homes);
    assert.strictEqual(l.at.get('b'), 0x48000);
    assert.strictEqual(l.moved, 1);
});

test('random: items are shuffled inside their spans, all placed, none overlapping', () => {
    const l = allocate(items, pool, [], homes, 42);
    assert.deepStrictEqual(l.failed, []);
    assert.ok(l.moved > 0);
    const spans = items.map(i => [l.at.get(i.key)!, l.at.get(i.key)! + i.bytes.length]).sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], 'overlap');
    for (const [s, e] of spans) assert.ok((s & 0xFFFF) >= 0x8000 && (s >> 16) === ((e - 1) >> 16), 'rule broken');
});

test('random: the same seed gives the same layout, another seed another one', () => {
    const at = (seed: number) => JSON.stringify([...allocate(items, pool, [], homes, seed).at].sort());
    assert.strictEqual(at(7), at(7));
    assert.ok([1, 2, 3, 4, 5].some(s => at(s) !== at(7)));
});

test('random with free space: items also leave their spans', () => {
    const l = allocate(items, pool, [{ start: 0x48000, end: 0x50000 }, { start: 0x58000, end: 0x60000 }], homes, 3);
    assert.deepStrictEqual(l.failed, []);
    assert.ok([...l.at.values()].some(at => at >= 0x48000));
});

test('no room anywhere: the item is reported, not dropped silently', () => {
    const l = allocate([...items, item('new', 0x1000)], pool, [], homes);
    assert.deepStrictEqual(l.failed.map(i => i.key), ['new']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
