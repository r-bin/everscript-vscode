// The grown ingredients kind's hooks (tools/open-evermore/evermore/codecs/ingredient-hooks.mts), run on the 65816
// interpreter: each entry reads or writes `$22FF + id` for a vanilla id and the id's own word for a new one, with A,
// X and the accumulator width as the call site expects them back. No ROM.
// Run: node tests/open-evermore/ingredient-hooks.test.mts   (npm run build:ts first: the interpreter is in dist/)
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { hooks, VANILLA_INGREDIENTS } from '../../tools/open-evermore/evermore/codecs/ingredient-hooks.mts';

const require = createRequire(import.meta.url);
const { Cpu65816 } = require('../../dist/platform/snes/cpu65816');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const CODE = 0xF08000, M = 0x20, I = 0x04;
/** Cells of the two new ingredients (ids 22, 23): temp[198] and temp[196]. */
const CELLS = [0x28FA, 0x28F8];

function machine() {
    const mem = new Uint8Array(0x1000000);
    const h = hooks(CODE + 0x200);
    mem.set(h.code, CODE);
    CELLS.forEach((c, k) => mem.set([c & 0xFF, c >> 8], CODE + 0x200 + 2 * k));
    const cpu = new Cpu65816({ read: (a: number) => mem[a], write: (a: number, v: number) => { mem[a] = v; } });
    const run = (entry: keyof typeof h.entry, regs: { a: number; x: number; m8: boolean }) => {
        Object.assign(cpu, { a: regs.a, x: regs.x, y: 0x5555, s: 0x1FF0, d: 0, db: 0x7E, p: (regs.m8 ? M : 0) | I });
        cpu.call(CODE + h.entry[entry]);
        return cpu;
    };
    const word = (a: number) => mem[0x7E0000 + a] | (mem[0x7E0000 + a + 1] << 8);
    return { mem, run, word };
}

test('the hooks fit their sites\' assumptions: cpx against the vanilla count', () => {
    assert.deepStrictEqual(hooks(CODE).code.slice(0, 3), [0xE0, VANILLA_INGREDIENTS, 0]);
});

test('get16: a vanilla id reads its byte and the next (as vanilla\'s lda.l), a new one its word', () => {
    const { mem, run } = machine();
    mem[0x7E22FF + 3] = 0x34; mem[0x7E22FF + 4] = 0x12; mem[0x7E28FA] = 7;
    let c = run('get16', { a: 0, x: 3, m8: false });
    assert.strictEqual(c.a, 0x1234); assert.strictEqual(c.x, 3); assert.strictEqual(c.y, 0x5555);
    c = run('get16', { a: 0, x: 22, m8: false });
    assert.strictEqual(c.a, 7); assert.strictEqual(c.x, 22); assert.strictEqual(c.s, 0x1FF0);
});

test('put16: writes the word, keeps A and X', () => {
    const { run, word } = machine();
    let c = run('put16', { a: 0x0209, x: 5, m8: false });
    assert.strictEqual(word(0x22FF + 5), 0x0209); assert.strictEqual(c.a, 0x0209);
    c = run('put16', { a: 0x0009, x: 23, m8: false });
    assert.strictEqual(word(0x28F8), 9); assert.strictEqual(c.a, 9); assert.strictEqual(c.x, 23); assert.strictEqual(c.s, 0x1FF0);
    assert.strictEqual(word(0x22FF + 23), 0, 'nothing written past the vanilla counts');
});

test('get8: 8-bit A, its high byte kept', () => {
    const { mem, run } = machine();
    mem[0x7E22FF + 2] = 0x11; mem[0x7E28FA] = 0x42;
    let c = run('get8', { a: 0xAB00, x: 2, m8: true });
    assert.strictEqual(c.a, 0xAB11);
    c = run('get8', { a: 0xAB00, x: 22, m8: true });
    assert.strictEqual(c.a, 0xAB42); assert.ok(c.m8); assert.strictEqual(c.x, 22); assert.strictEqual(c.s, 0x1FF0);
});

test('shopGet: ldx $12 and sep #$20 as the 7 bytes it replaces, then the count', () => {
    const { mem, run } = machine();
    mem[0x12] = 22; mem[0x7E28FA] = 3;
    const c = run('shopGet', { a: 0xCD00, x: 0, m8: false });
    assert.strictEqual(c.x, 22); assert.ok(c.m8); assert.strictEqual(c.a & 0xFF, 3);
});

test('shopPut: sta and rep #$20 as the 5 bytes it replaces', () => {
    const { run, word, mem } = machine();
    let c = run('shopPut', { a: 0x0063, x: 22, m8: true });
    assert.strictEqual(mem[0x7E28FA], 0x63); assert.ok(!c.m8); assert.strictEqual(c.x, 22); assert.strictEqual(c.s, 0x1FF0);
    c = run('shopPut', { a: 0x0005, x: 1, m8: true });
    assert.strictEqual(mem[0x7E22FF + 1], 5); assert.ok(!c.m8);
    assert.strictEqual(word(0x28FA), 0x63);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
