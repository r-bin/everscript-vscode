// tools/compare's pure logic (diff.mts): the tracker finds the first diverging checkpoint whatever order the setups
// report in, skips keys before a sync point, and the byte and write differences name where two runs part.
// Synthetic hash streams; no ROM, no core.
// Run: node tests/compare/compare-units.test.mts
import assert from 'node:assert';
import { Tracker, combined, byteDiff, runs, firstDifferingWrites, type Write } from '../../tools/compare/diff.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

/** WRAM and VRAM CRCs at a key; `bad` changes the WRAM one from that key on. */
const stream = (key: number, bad = Infinity) => [key < bad ? key * 7 : key * 7 + 1, key * 13];

test('combined hash changes with any region', () => {
    assert.notStrictEqual(combined([1, 2]), combined([1, 3]));
    assert.strictEqual(combined([5, 6]), combined([5, 6]));
});

test('first divergence with the reference first', () => {
    const t = new Tracker(1);
    for (let k = 60; k <= 600; k += 60) t.addRef(k, stream(k));
    const hits: number[] = [];
    for (let k = 60; k <= 600; k += 60) if (t.addTarget(0, k, stream(k, 300))) hits.push(k);
    assert.deepStrictEqual(hits, [300]);
    assert.deepStrictEqual(t.results[0].first, { lastGood: 240, key: 300, regions: [0] });
    assert.strictEqual(t.results[0].differing, 6);
});

test('first divergence with the target first (pending until the reference arrives)', () => {
    const t = new Tracker(2);
    for (let k = 60; k <= 600; k += 60) { t.addTarget(0, k, stream(k, 420)); t.addTarget(1, k, stream(k)); }
    const hits: number[][] = [];
    for (let k = 1; k <= 600; k++) { const h = t.addRef(k, stream(k)); if (h.length) hits.push([k, ...h]); }
    assert.deepStrictEqual(hits, [[420, 0]]);
    assert.strictEqual(t.results[0].first!.lastGood, 360);
    assert.strictEqual(t.results[1].first, null);
    assert.strictEqual(t.results[1].compared, 10);
});

test('keys up to the sync point are not compared', () => {
    const t = new Tracker(1, 115);
    t.addRef(60, [1, 1]); t.addRef(120, [2, 2]);
    assert.strictEqual(t.addTarget(0, 60, [9, 9]), false);
    assert.strictEqual(t.addTarget(0, 120, [2, 2]), false);
    assert.strictEqual(t.results[0].compared, 1);
    assert.strictEqual(t.results[0].first, null);
});

test('byte diff skips ignored offsets and counts past the cap', () => {
    const a = new Uint8Array(16), b = new Uint8Array(16);
    b[2] = 1; b[3] = 1; b[4] = 1; b[9] = 5;
    const d = byteDiff(a, b, new Set([3]), 2);
    assert.strictEqual(d.total, 3);
    assert.deepStrictEqual(d.diffs.map(x => x.offset), [2, 4]);
    assert.deepStrictEqual(runs([9, 2, 3, 4]), [[2, 4], [9, 9]]);
});

test('first differing write per byte', () => {
    const w = (frame: number, offset: number, pc: number, value: number): Write => ({ frame, offset, pc, value });
    const a = [w(0, 0x10, 0x808000, 1), w(2, 0x10, 0x808010, 2), w(1, 0x20, 0x809000, 7)];
    const b = [w(0, 0x10, 0x808000, 1), w(2, 0x10, 0xF81234, 3), w(1, 0x20, 0x809000, 7), w(3, 0x30, 0xF80000, 0)];
    const s = firstDifferingWrites(a, b);
    assert.deepStrictEqual(s.map(x => [x.offset, x.index]), [[0x10, 1], [0x30, 0]]);
    assert.strictEqual(s[0].b!.pc, 0xF81234);
    assert.strictEqual(s[1].a, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
