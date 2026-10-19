// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

// Runs injectEverscript as the webview gets it: extracted from the generated
// HTML, not from the source file. The script lives in a template literal, so a
// regex written with single backslashes (\s, \w) loses them on the way out and
// stops matching; a test against the source text would not see that.

const assert = require('assert');
// The page as Everscript builds it: with Evermore's part (games/evermore/emulator/host.ts webview()).
const _gameView = require('../../dist/games/evermore/emulator/host').webview();
const buildHtml = (w, js, wasm, label, p, offer, opts) => require('../../dist/core/emulator/panel-webview').buildHtml(w, js, wasm, label, p, offer || null, Object.assign({ gameView: _gameView }, opts || {}));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

function extractFunction(src, name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start >= 0, name + ' not found in generated script');
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error('unbalanced braces in ' + name);
}

const html = String(buildHtml({ cspSource: 'x', asWebviewUri: u => u }, 'core.js', 'core.wasm', 'core', 'core.js'));
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const makeInject = new Function(
    'getModule', 'hasDebuggerApi', 'setText', 'fmtHex', 'SLOT_COUNT', 'SLOT_SIZE', 'SCRIPT_STACK_BUS_ADDR',
    'return ' + extractFunction(script, 'injectEverscript'));

function fakeModule() {
    const mem = new Map();
    return {
        mem,
        readMemory: a => mem.get(a) || 0,
        writeMemory: (a, v) => mem.set(a, v & 0xFF),
        word: a => (mem.get(a) || 0) | ((mem.get(a + 1) || 0) << 8),
    };
}

function inject(m, code) {
    const fn = makeInject(() => m, () => true, () => {}, v => v.toString(16), 20, 0x4F, 0x7E28FC);
    return fn(code);
}

console.log('Everscript Injection Tests:');

test('walk() parses in the generated script and lands in WRAM', () => {
    const m = fakeModule();
    assert.strictEqual(inject(m, 'walk(ACTIVE, COORDINATE_ABSOLUTE, 120, 280)'), true);
    const code = [];
    for (let i = 0; i < 9; i++) code.push(m.readMemory(0x7FFF00 + i));
    assert.deepStrictEqual(code, [0x9D, 0xD2, 0x84, 120, 0, 0x84, 280 & 0xFF, 280 >> 8, 0x00]);
});

test('the slot is filled like $8CCF18 and appended to the run list', () => {
    const m = fakeModule();
    // Slot 0 busy, one script already on the run list.
    m.writeMemory(0x7E28FC + 3, 2);
    m.writeMemory(0x7E2F28, 0xFC); m.writeMemory(0x7E2F29, 0x28);
    m.writeMemory(0x7E0086, 2);
    assert.strictEqual(inject(m, 'walk(BOY, COORDINATE_ABSOLUTE, 16, 32)'), true);
    const slot = 0x7E28FC + 0x4F;
    assert.strictEqual(m.word(slot) | (m.readMemory(slot + 2) << 16), 0x7FFF00);
    assert.strictEqual(m.word(slot + 3), 2);
    assert.strictEqual(m.word(0x7E2F28 + 2), slot & 0xFFFF);
    assert.strictEqual(m.word(0x7E2F28 + 4), 0);
    assert.strictEqual(m.word(0x7E0086), 4);
});

test('hex bytecode parses in the generated script', () => {
    const m = fakeModule();
    assert.strictEqual(inject(m, '9d d2 84 10 00 84 20 00'), true);
    assert.strictEqual(m.readMemory(0x7FFF00), 0x9D);
    assert.strictEqual(m.readMemory(0x7FFF08), 0x00);
});

test('right-click walk waits for arrival, hands control back, and does not reuse a live buffer', () => {
    const m = fakeModule();
    const fn = makeInject(() => m, () => true, () => {}, v => v.toString(16), 20, 0x4F, 0x7E28FC);
    assert.strictEqual(fn('walk(ACTIVE, COORDINATE_ABSOLUTE, 120, 280, ACTIVE, ACTIVE)'), true);
    const code = [];
    for (let i = 0; i < 13; i++) code.push(m.readMemory(0x7FFF00 + i));
    // walk, (2e) wait for ACTIVE, (2b) ACTIVE player-controlled again, END
    assert.deepStrictEqual(code, [0x9D, 0xD2, 0x84, 120, 0, 0x84, 280 & 0xFF, 280 >> 8, 0x2E, 0xD2, 0x2B, 0xD2, 0x00]);
    assert.strictEqual(fn('walk(ACTIVE, COORDINATE_ABSOLUTE, 8, 8, ACTIVE, ACTIVE)'), true);
    assert.strictEqual(m.readMemory(0x7FFF40), 0x9D, 'second walk goes to the next buffer');
    assert.strictEqual(m.readMemory(0x7FFF08), 0x2E, 'first walk is left intact');
});

test('no free slot refuses instead of overwriting a live script', () => {
    const m = fakeModule();
    for (let s = 0; s < 20; s++) m.writeMemory(0x7E28FC + s * 0x4F + 3, 2);
    assert.strictEqual(inject(m, 'walk(ACTIVE, COORDINATE_ABSOLUTE, 1, 1)'), false);
    assert.strictEqual(m.word(0x7E0086), 0);
});

test('destroy(BOY) and destroy(0x4E89) parse and land in WRAM', () => {
    const m = fakeModule();
    assert.strictEqual(inject(m, 'destroy(BOY)'), true);
    assert.strictEqual(m.readMemory(0x7FFF00), 0x9B);
    assert.strictEqual(m.readMemory(0x7FFF01), 0xD0);
    assert.strictEqual(m.readMemory(0x7FFF02), 0x00);

    const m2 = fakeModule();
    assert.strictEqual(inject(m2, 'destroy(0x4E89)'), true);
    assert.strictEqual(m2.readMemory(0x7FFF00), 0x9B);
    assert.strictEqual(m2.readMemory(0x7FFF01), 0x84);
    assert.strictEqual(m2.readMemory(0x7FFF02), 0x89);
    assert.strictEqual(m2.readMemory(0x7FFF03), 0x4E);
    assert.strictEqual(m2.readMemory(0x7FFF04), 0x00);
});

test('call_id(0x36) parses and lands in WRAM', () => {
    const m = fakeModule();
    assert.strictEqual(inject(m, 'call_id(0x36)'), true);
    assert.strictEqual(m.readMemory(0x7FFF00), 0xA4);
    assert.strictEqual(m.readMemory(0x7FFF01), 0x36);
    assert.strictEqual(m.readMemory(0x7FFF02), 0x00);
    assert.strictEqual(m.readMemory(0x7FFF03), 0x00);
});

test('set_object_state(2, 1) parses and lands in WRAM', () => {
    const m = fakeModule();
    assert.strictEqual(inject(m, 'set_object_state(2, 1)'), true);
    assert.strictEqual(m.readMemory(0x7FFF00), 0x5C);
    assert.strictEqual(m.readMemory(0x7FFF01), 0x82);
    assert.strictEqual(m.readMemory(0x7FFF02), 0x02);
    assert.strictEqual(m.readMemory(0x7FFF03), 0x82);
    assert.strictEqual(m.readMemory(0x7FFF04), 0x01);
    assert.strictEqual(m.readMemory(0x7FFF05), 0x00);
});

test('object[0x02] = 1 and object(2, 1) parse and land in WRAM', () => {
    const m1 = fakeModule();
    assert.strictEqual(inject(m1, 'object[0x02] = 1'), true);
    assert.strictEqual(m1.readMemory(0x7FFF00), 0x5C);
    assert.strictEqual(m1.readMemory(0x7FFF01), 0x82);
    assert.strictEqual(m1.readMemory(0x7FFF02), 0x02);
    assert.strictEqual(m1.readMemory(0x7FFF03), 0x82);
    assert.strictEqual(m1.readMemory(0x7FFF04), 0x01);
    assert.strictEqual(m1.readMemory(0x7FFF05), 0x00);

    const m2 = fakeModule();
    assert.strictEqual(inject(m2, 'object(2, 1)'), true);
    assert.strictEqual(m2.readMemory(0x7FFF00), 0x5C);
    assert.strictEqual(m2.readMemory(0x7FFF02), 0x02);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
