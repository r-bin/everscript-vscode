// Game controllers as one SNES pad (src/core/emulator/gamepad.ts): every connected pad counts (Windows
// lists idle or virtual pads first), raw-mapping pads with a hat-switch D-pad or axis buttons, bindings
// of each kind, a Gamepad API that throws. Synthetic pads; no browser.
// Run: node tests/debugger/emulator-gamepad.test.mts
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pad = require('../../dist/core/emulator/gamepad');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const MASKS = { R: 1 << 4, L: 1 << 5, X: 1 << 6, A: 1 << 7, Right: 1 << 8, Left: 1 << 9, Down: 1 << 10, Up: 1 << 11, Start: 1 << 12, Select: 1 << 13, Y: 1 << 14, B: 1 << 15 };
const MAP = { Up: 12, Down: 13, Left: 14, Right: 15, B: 0, A: 1, Y: 2, X: 3, L: 4, R: 5, Select: 8, Start: 9, Rewind: 6, Speed: 7 };
const HAT_REST = 1.2857;

function mk(opts: { index?: number; id?: string; mapping?: string; held?: number[]; axes?: number[]; buttons?: number }) {
    const n = opts.buttons ?? 17;
    return {
        id: opts.id ?? 'Pad', index: opts.index ?? 0, mapping: opts.mapping ?? 'standard', connected: true,
        buttons: Array.from({ length: n }, (_, i) => ({ pressed: (opts.held || []).includes(i), value: (opts.held || []).includes(i) ? 1 : 0 })),
        axes: opts.axes ?? [0, 0, 0, 0],
    };
}
const nav = (...pads: unknown[]) => ({ getGamepads: () => pads });

test('the bottom face button of a standard pad is SNES B; nothing held is 0', () => {
    assert.strictEqual(pad.padBits([mk({ held: [0] })], MAP, MASKS, new Set()), MASKS.B);
    assert.strictEqual(pad.padBits([mk({})], MAP, MASKS, new Set()), 0);
});

test('a pad that is not first in the list still plays (idle virtual pad at index 0, empty slots)', () => {
    const pads = pad.connectedPads(nav(null, mk({ index: 1, id: 'idle' }), mk({ index: 2, held: [1] })));
    assert.strictEqual(pads.length, 2);
    assert.strictEqual(pad.padBits(pads, MAP, MASKS, new Set()), MASKS.A);
});

test('two pads held at once OR together', () => {
    const bits = pad.padBits([mk({ held: [0] }), mk({ index: 1, held: [3] })], MAP, MASKS, new Set());
    assert.strictEqual(bits, MASKS.B | MASKS.X);
});

test('a throwing or missing Gamepad API gives no pads', () => {
    assert.deepStrictEqual(pad.connectedPads({ getGamepads() { throw new Error('SecurityError'); } }), []);
    assert.deepStrictEqual(pad.connectedPads({}), []);
    assert.deepStrictEqual(pad.connectedPads(undefined), []);
});

test('the left stick is the cross on any pad', () => {
    assert.strictEqual(pad.padBits([mk({ axes: [-0.9, 0.8] })], MAP, MASKS, new Set()), MASKS.Left | MASKS.Down);
    assert.strictEqual(pad.padBits([mk({ axes: [0.3, -0.3] })], MAP, MASKS, new Set()), 0);
});

test('a raw pad with a hat-switch D-pad: the hat is the cross, all eight positions', () => {
    const hats = new Set<string>();
    const raw = (h: number) => mk({ mapping: '', buttons: 12, axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, h] });
    assert.strictEqual(pad.padBits([raw(HAT_REST)], MAP, MASKS, hats), 0, 'a hat at rest');
    const at = (step: number) => pad.padBits([raw(-1 + step * 2 / 7)], MAP, MASKS, hats);
    assert.strictEqual(at(0), MASKS.Up);
    assert.strictEqual(at(1), MASKS.Up | MASKS.Right);
    assert.strictEqual(at(2), MASKS.Right);
    assert.strictEqual(at(4), MASKS.Down);
    assert.strictEqual(at(6), MASKS.Left);
    assert.strictEqual(at(7), MASKS.Up | MASKS.Left);
});

test('axis and hat directions bind like buttons', () => {
    const map = Object.assign({}, MAP, { L: 'a4+', R: 'h9right' });
    const hats = new Set<string>();
    const p = (axes: number[]) => mk({ mapping: '', buttons: 10, axes });
    pad.padBits([p([0, 0, 0, 0, -1, 0, 0, 0, 0, HAT_REST])], map, MASKS, hats);
    assert.strictEqual(pad.padBits([p([0, 0, 0, 0, 0.9, 0, 0, 0, 0, HAT_REST])], map, MASKS, hats), MASKS.L, 'trigger axis pulled');
    assert.strictEqual(pad.padBits([p([0, 0, 0, 0, -1, 0, 0, 0, 0, -1 + 4 / 7])], map, MASKS, hats) & MASKS.R, MASKS.R, 'hat right');
});

test('binding takes the first newly held control, not one already held', () => {
    const held = new Set<string>();
    assert.strictEqual(pad.newControl([mk({ held: [2] })], new Set(), held), 2);
    assert.strictEqual(pad.newControl([mk({ held: [2] })], new Set(), held), null, 'still held');
    assert.strictEqual(pad.newControl([mk({ held: [2, 5] })], new Set(), held), 5);
    assert.strictEqual(pad.newControl([mk({ axes: [0, 0, 0, 0.95] })], new Set(), held), 'a3+');
});

test('a trigger axis resting at -1 is never a new press', () => {
    const held = new Set<string>();
    const rest = mk({ mapping: '', axes: [0, 0, -1, 0] });
    pad.newControl([rest], new Set(), held);
    assert.strictEqual(pad.newControl([rest], new Set(), held), null);
});

test('saved bindings: numbers, axis and hat strings pass; junk does not', () => {
    for (const ok of [0, 15, 'a2+', 'a10-', 'h9up', 'h9left']) assert.ok(pad.isBind(ok), String(ok));
    for (const bad of [-1, 1.5, 'x', 'a2', 'h9', null, undefined, {}]) assert.ok(!pad.isBind(bad), String(bad));
});

test('labels: standard face names, raw numbers, axes and hats', () => {
    assert.strictEqual(pad.formatBind(0, true), 'Bottom');
    assert.strictEqual(pad.formatBind(0, false), 'Btn 0');
    assert.strictEqual(pad.formatBind(20, true), 'Btn 20');
    assert.strictEqual(pad.formatBind('a2-', true), 'Axis 2-');
    assert.strictEqual(pad.formatBind('h9down', false), 'Hat Down');
    assert.strictEqual(pad.formatBind(undefined, true), 'None');
});

test('the banner names the pads or says how to wake one', () => {
    assert.match(pad.describePads([]), /press a button/);
    assert.strictEqual(pad.describePads([mk({ id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' })]), 'Input: Keyboard & Xbox 360 Controller');
    assert.match(pad.describePads([mk({ id: 'USB Gamepad', mapping: '' })]), /USB Gamepad \(raw\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
