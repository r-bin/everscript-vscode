// Redrawing a converted room's cells with fewer graphics, the picture unchanged (src/games/evermore/imports/common/redraw.ts):
// a colour twin in another palette, one graphic over another, never a cycling colour swapped, and fitCells' new list.
// Synthetic graphics and palettes; no ROM.
// Run: node tests/imports/redraw.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { redrawWithFewer, fitCells } = require('../../dist/games/evermore/imports/common/redraw');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

type Ref = { slot: number; h: number; v: number; palette: number; priority: number };
type Pair = { top: Ref | null; bottom: Ref | null; count: number };
const RED = 0x001F, BLUE = 0x7C00, GREEN = 0x03E0;
/** Palette 0: 1 red, 2 blue, 3 green; palette 1: 1 blue, 2 red, 3 green. */
const PALETTES: Record<number, number[]> = { 0: [0, RED, BLUE, GREEN], 1: [0, BLUE, RED, GREEN] };
const colour = (p: number, k: number) => PALETTES[p][k];
/** A 16x16 graphic: `left` index on columns 0-7, `right` on 8-15. */
const graphic = (left: number, right: number) => Uint8Array.from({ length: 256 }, (_, i) => ((i & 15) < 8 ? left : right));
const ref = (slot: number, palette: number): Ref => ({ slot, h: 0, v: 0, palette, priority: 0 });
/** What a pair shows, pixel by pixel (layer 1 over layer 2), in BGR555; -1 nothing. */
function picture(slots: Uint8Array[], p: Pair): number[] {
    const at = (r: Ref | null, i: number) => {
        if (!r) return 0;
        const x = r.h ? 15 - (i & 15) : i & 15, y = r.v ? 15 - (i >> 4) : i >> 4;
        return slots[r.slot][y * 16 + x];
    };
    return Array.from({ length: 256 }, (_, i) => {
        const t = at(p.top, i), b = at(p.bottom, i);
        return t ? colour(p.top!.palette, t) : b ? colour(p.bottom!.palette, b) : -1;
    });
}
const opts = (o: Partial<{ stack: boolean; moving: (p: number, k: number) => boolean; max: number }> = {}) => ({
    colour, moving: o.moving ?? (() => false), palettes: [0, 1], keep: new Set([0]), stack: o.stack ?? false, max: o.max ?? 2,
});

test('a graphic with the same colours in another palette goes: its cells name the twin', () => {
    // Slot 1 drawn in palette 0 is all red; slot 2 drawn in palette 1 is all red too.
    const slots = [graphic(0, 0), graphic(1, 1), graphic(2, 2)];
    const pairs: Pair[] = [{ top: null, bottom: ref(1, 0), count: 1 }, { top: null, bottom: ref(2, 1), count: 5 }, { top: null, bottom: ref(2, 0), count: 5 }];
    const before = pairs.map((p) => picture(slots, p));
    const r = redrawWithFewer(slots, pairs, opts());
    assert.deepStrictEqual([...r.removed], [1], 'the rarer one');
    assert.strictEqual(r.twins, 1);
    assert.deepStrictEqual(pairs[0].bottom, ref(2, 1));
    assert.deepStrictEqual(pairs.map((p) => picture(slots, p)), before);
});

test('a cycling colour keeps its index: no twin in another palette', () => {
    const slots = [graphic(0, 0), graphic(1, 1), graphic(2, 2)];
    const pairs: Pair[] = [{ top: null, bottom: ref(1, 0), count: 1 }, { top: null, bottom: ref(2, 1), count: 5 }];
    const r = redrawWithFewer(slots, pairs, opts({ moving: (p, k) => p === 0 && k === 1 }));
    assert.strictEqual(r.removed.size, 0);
    assert.deepStrictEqual(pairs[0].bottom, ref(1, 0));
});

test('a graphic that is one graphic over another goes when the layers are alike, stays when not', () => {
    // Slot 3 is red | green: slot 1 (red | nothing) on layer 1 over slot 2 (green | green) on layer 2.
    const slots = () => [graphic(0, 0), graphic(1, 0), graphic(3, 3), graphic(1, 3)];
    const pairs = (): Pair[] => [{ top: ref(1, 0), bottom: ref(2, 0), count: 4 }, { top: null, bottom: ref(3, 0), count: 1 }];
    const s = slots(), p = pairs(), before = p.map((x) => picture(s, x));
    const r = redrawWithFewer(s, p, opts({ stack: true, max: 3 }));
    assert.deepStrictEqual([...r.removed], [3]);
    assert.strictEqual(r.stacks, 1);
    assert.deepStrictEqual([p[1].top!.slot, p[1].bottom!.slot], [1, 2]);
    assert.deepStrictEqual(p.map((x) => picture(s, x)), before);
    const q = pairs();
    assert.strictEqual(redrawWithFewer(slots(), q, opts({ stack: false, max: 3 })).removed.size, 0, 'BG1 and BG2 not alike: nothing moves between them');
    assert.deepStrictEqual(q[1].bottom, ref(3, 0));
});

test('a cell whose layers differ in priority keeps them', () => {
    // Slot 3 (red | green) shows only in a cell over slot 2 at another priority: it stays. Slot 1 may go: its cell, both
    // at priority 0, is slot 3 alone.
    const s = [graphic(0, 0), graphic(1, 0), graphic(3, 3), graphic(1, 3)];
    const mixed = { top: { ...ref(3, 0), priority: 1 }, bottom: ref(2, 0), count: 1 };
    const p: Pair[] = [{ top: ref(1, 0), bottom: ref(2, 0), count: 4 }, mixed];
    const before = p.map((x) => picture(s, x));
    const r = redrawWithFewer(s, p, opts({ stack: true, max: 3 }));
    assert.deepStrictEqual([...r.removed], [1]);
    assert.deepStrictEqual([mixed.top, mixed.bottom], [{ ...ref(3, 0), priority: 1 }, ref(2, 0)]);
    assert.deepStrictEqual([p[0].top, p[0].bottom], [null, ref(3, 0)]);
    assert.deepStrictEqual(p.map((x) => picture(s, x)), before);
});

test('a cell showing the graphic on both layers gets the twin on both', () => {
    const slots = [graphic(0, 0), graphic(1, 0), graphic(2, 0)];
    const pairs: Pair[] = [{ top: ref(1, 0), bottom: ref(1, 0), count: 1 }, { top: null, bottom: ref(2, 1), count: 5 }];
    redrawWithFewer(slots, pairs, opts());
    assert.deepStrictEqual([pairs[0].top, pairs[0].bottom], [ref(2, 1), ref(2, 1)]);
});

test('fitCells: past 256, the twin first, then one approximated; refs point into the new list, a shared ref moved once', () => {
    // 258 graphics: empty, the red one and its twin, an all-green one, 254 one-offs (green corner, a red pixel) shown often.
    const filler = (k: number) => Uint8Array.from({ length: 256 }, (_, i) => (i === 0 ? 3 : i === k + 1 ? 1 : 0));
    const slots = [graphic(0, 0), graphic(1, 1), graphic(2, 2), graphic(3, 3), ...Array.from({ length: 254 }, (_, k) => filler(k))];
    const shared = ref(3, 0);
    const pairs: Pair[] = [{ top: null, bottom: ref(1, 0), count: 1 }, { top: null, bottom: ref(2, 1), count: 5 }, { top: null, bottom: shared, count: 2 },
        { top: shared, bottom: ref(2, 1), count: 2 }, ...Array.from({ length: 254 }, (_, k) => ({ top: null, bottom: ref(4 + k, 0), count: 100 }))];
    const twin = picture(slots, pairs[0]);
    const fit = fitCells(slots, pairs, { colour, moving: () => false, palettes: [0, 1], keep: new Set([0]), stack: false });
    assert.deepStrictEqual([fit.redrawn, fit.twins, fit.substituted, fit.slots.length], [1, 1, 1, 256]);
    assert.ok(pairs.every((p) => [p.top, p.bottom].every((r) => !r || r.slot < 256)));
    assert.deepStrictEqual(picture(fit.slots, pairs[0]), twin);
    assert.ok(pairs[2].bottom === shared && pairs[3].top === shared);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
