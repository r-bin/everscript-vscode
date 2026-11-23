// The grown consumables kind's hooks (tools/open-evermore/evermore/codecs/consumable-hooks.mts), run on the 65816
// interpreter: the counts read and written at `$2315 + id` for a vanilla id, 0 for the Pouch, the id's own word for a
// new one; and the items ring's dispatch entering vanilla's handler or the use handler in bank $8E with X = 2·id and
// returning where `jsr ($A873,x)` would have. No ROM.
// Run: node tests/open-evermore/item-hooks.test.mts   (npm run build:ts first: the interpreter is in dist/)
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { DISPATCH, hooks, POUCH, USE_HANDLER, VANILLA_CONSUMABLES } from '../../tools/open-evermore/evermore/codecs/consumable-hooks.mts';

const require = createRequire(import.meta.url);
const { Cpu65816 } = require('../../dist/platform/snes/cpu65816');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const CODE = 0xF08000, I = 0x04, SITE = 0x8EA866;
/** Cells of the two new consumables (ids 9, 10): temp[196] and temp[194]. */
const CELLS = [0x28F8, 0x28F6];

function machine() {
    const mem = new Uint8Array(0x1000000);
    const h = hooks(CODE + 0x200);
    mem.set(h.code, CODE);
    CELLS.forEach((c, k) => mem.set([c & 0xFF, c >> 8], CODE + 0x200 + 2 * k));
    // The ring loop's site: `jsl dispatch` where `tax : jsr ($A873,x)` was, then the `rts` the test returns by.
    const e = CODE + h.entry.dispatch;
    mem.set([0x22, e & 0xFF, (e >> 8) & 0xFF, e >> 16, 0x60], SITE);
    // Handlers in bank $8E: each stores X and A where the test reads them, then returns by rts.
    const handler = (at: number, slot: number) => mem.set([0x8E, slot, 0x00, 0x8D, slot + 2, 0x00, 0x60], 0x8E0000 | at);
    handler(USE_HANDLER, 0x10);
    handler(0x9000, 0x20);
    mem.set([0x00, 0x90], 0x8EA873 + 2 * 3);   // vanilla's table: id 3 → $9000
    const cpu = new Cpu65816({ read: (a: number) => mem[a], write: (a: number, v: number) => { mem[a] = v; } });
    const regs = (a: number, x: number) => Object.assign(cpu, { a, x, y: 0x5555, s: 0x1FF0, d: 0, db: 0x7E, p: I });
    const run = (entry: 'get16' | 'put16', a: number, x: number) => { regs(a, x); cpu.call(CODE + h.entry[entry]); return cpu; };
    const word = (a: number) => mem[0x7E0000 + a] | (mem[0x7E0000 + a + 1] << 8);
    return { mem, cpu, regs, run, word };
}

test('the dispatch site is the 4 bytes a jsl takes', () => assert.strictEqual(DISPATCH.length, 4));

test('get16: a vanilla id its byte and the next, the Pouch 0, a new id its word', () => {
    const { mem, run } = machine();
    mem[0x7E2315 + 2] = 0x34; mem[0x7E2315 + 3] = 0x12; mem[0x7E2315 + POUCH] = 5; mem[0x7E28F6] = 7;
    let c = run('get16', 0, 2);
    assert.strictEqual(c.a, 0x1234); assert.strictEqual(c.x, 2); assert.strictEqual(c.y, 0x5555);
    c = run('get16', 0xFFFF, POUCH);
    assert.strictEqual(c.a, 0, 'the Pouch has no count ($231D is armour\'s)');
    c = run('get16', 0, 10);
    assert.strictEqual(c.a, 7); assert.strictEqual(c.x, 10); assert.strictEqual(c.s, 0x1FF0);
});

test('put16: writes the word, keeps A and X', () => {
    const { run, word } = machine();
    let c = run('put16', 0x0004, 1);
    assert.strictEqual(word(0x2315 + 1), 4);
    c = run('put16', 0x0003, VANILLA_CONSUMABLES);
    assert.strictEqual(word(0x28F8), 3); assert.strictEqual(c.a, 3); assert.strictEqual(c.x, VANILLA_CONSUMABLES); assert.strictEqual(c.s, 0x1FF0);
    assert.strictEqual(word(0x2315 + VANILLA_CONSUMABLES), 0, 'nothing written past the vanilla counts');
});

test('dispatch: a vanilla id runs its handler from the table, X = A = 2·id, and returns behind the site', () => {
    const { cpu, regs, word } = machine();
    regs(2 * 3, 0x1234);
    cpu.call(SITE, { rts: true });
    assert.strictEqual(word(0x20), 6, 'X'); assert.strictEqual(word(0x22), 6, 'A');
    assert.strictEqual(cpu.s, 0x1FF0, 'the stack as before');
});

test('dispatch: a new id runs the use handler with X = 2·id', () => {
    const { cpu, regs, word } = machine();
    regs(2 * 10, 0);
    cpu.call(SITE, { rts: true });
    assert.strictEqual(word(0x10), 20, 'X'); assert.strictEqual(word(0x12), 20, 'A');
    assert.strictEqual(word(0x20), 0, 'not the vanilla table');
    assert.strictEqual(cpu.s, 0x1FF0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
