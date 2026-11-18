// Open Evermore implode (docs/open-evermore/validation.md): a synthetic kind ("things": blobs reached through a
// pointer table, like Evermore's rooms) on a synthetic 256 KiB HiROM image. Explode → implode gives the image back
// (G0); --random moves the blobs and the table follows; every validation rule fails where it should. No ROM, no dist/.
// Run: node tests/open-evermore/implode.test.mts
import assert from 'node:assert';
import type { Codec, Item } from '../../tools/open-evermore/codec.mts';
import { ENUM, enumFile, resolveEnum } from '../../tools/open-evermore/enum.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { json, readText, sha1 } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

const TABLE = 0x10000, COUNT = 4, NAMES = ['alpha', 'beta', 'gamma', 'delta'];
const ptr = (rom: Uint8Array, id: number) => (rom[TABLE + id * 3] | (rom[TABLE + id * 3 + 1] << 8) | (rom[TABLE + id * 3 + 2] << 16)) & 0x3FFFFF;
const len = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);   // a thing starts with its length

const things: Codec = {
    kind: 'things', version: 1, path: 'things',
    defaultName: id => NAMES[id],
    explode(rom, name) {
        const names = NAMES.map((_, id) => name('things', id));
        const files: Tree = new Map(), pool = [], homes = [];
        for (let id = 0; id < COUNT; id++) {
            const at = ptr(rom, id), bytes = rom.slice(at, at + len(rom, at));
            files.set(`things/${names[id]}.bin`, bytes);
            pool.push({ start: at, end: at + bytes.length });
            homes.push({ key: `things/${names[id]}`, at, length: bytes.length, sha1: sha1(bytes) });
        }
        files.set(`things/${ENUM}`, enumFile({ kind: 'things', limit: COUNT, why: 'the table has 4 slots', names }));
        return { files, pool, tables: [{ start: TABLE, end: TABLE + COUNT * 3 }], homes };
    },
    names({ tree }) {
        return new Set([...tree.keys()].filter(p => p.startsWith('things/') && p.endsWith('.bin')).map(p => p.slice(7, -4)));
    },
    encode({ tree }, names) {
        return [...names].map((n): Item => ({ key: `things/${n}`, file: `things/${n}.bin`, bytes: tree.get(`things/${n}.bin`)!, rule: { upperHalf: true, noCrossBank: true } }));
    },
    tables(ctx, placed) {
        const bytes = new Uint8Array(COUNT * 3);
        for (const [name, id] of ctx.ids.get('things')!) {
            const bus = 0x800000 | placed.get(`things/${name}`)!;
            bytes.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16], id * 3);
        }
        return [{ at: TABLE, bytes, file: `things/${ENUM}` }];
    },
};

function syntheticRom(): Uint8Array {
    const rom = new Uint8Array(0x40000);
    let x = 0x2468ACE1;
    for (let i = 0; i < rom.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rom[i] = x & 0xFF; }
    rom[0xFFD5] = 0x31; rom[0xFFD7] = 0x08; rom[0xFFD8] = 0x00;    // HiROM FastROM, 256 KiB, no SRAM
    let at = 0x28000;
    [0x1800, 0x2000, 0x1000, 0x3000].forEach((n, id) => {
        if ((at >> 16) !== ((at + n - 1) >> 16)) at = ((at >> 16) + 1 << 16) | 0x8000;
        rom.set([n & 0xFF, n >> 8], at);
        const bus = 0x800000 | at;
        rom.set([bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16], TABLE + id * 3);
        at += n;
    });
    // the checksum the cartridge would carry, so the original is self-consistent
    let sum = 0;
    rom.set([0xFF, 0xFF, 0, 0], 0xFFDC);
    for (const b of rom) sum += b;
    rom.set([~sum & 0xFF, (~sum >> 8) & 0xFF, sum & 0xFF, (sum >> 8) & 0xFF], 0xFFDC);
    return rom;
}

const ROM = syntheticRom();
const BASE = { release: 'test', sha1: sha1(ROM), explodedWith: '0.0.0' };
const fresh = (): Tree => explode(ROM, BASE, 'test', [things]);
const run = (t: Tree, opts = {}) => implode(t, 'test', [things], opts);
const rules = (t: Tree, opts = {}) => run(t, opts).findings.list.filter(f => f.severity !== 'info').map(f => f.rule);
const editJson = (t: Tree, path: string, edit: (v: any) => void) => { const v = JSON.parse(readText(t.get(path)!)); edit(v); t.set(path, json(v)); };

console.log('\nOpen Evermore — implode:');

test('explode: one file per thing, the enum, the base with the pool blanked', () => {
    const t = fresh();
    assert.deepStrictEqual([...t.keys()].sort(), ['_base/_base.json', '_base/unexploded.bin', 'manifest.json',
        'things/_enum.json', 'things/alpha.bin', 'things/beta.bin', 'things/delta.bin', 'things/gamma.bin']);
    const base = t.get('_base/unexploded.bin')!;
    assert.ok(base.subarray(0x28000, 0x29800).every(b => b === 0xFF));
});

test('G0: stable implode gives the image back byte for byte, no warnings', () => {
    const r = run(fresh());
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(r.sha1, BASE.sha1);
});

test('random: things move, the table follows, the round trip holds', () => {
    const r = run(fresh(), { seed: 5 });
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
    assert.ok(r.image && r.sha1 !== BASE.sha1);
    assert.ok(r.placed.some(p => p.at !== p.home));
    for (let id = 0; id < COUNT; id++) {
        const at = ptr(r.image!, id);
        assert.ok(Buffer.from(r.image!.subarray(at, at + len(r.image!, at))).equals(Buffer.from(fresh().get(`things/${NAMES[id]}.bin`)!)));
    }
});

test('the enum decides ids: reordering it reorders the table, not the files', () => {
    const t = fresh();
    editJson(t, 'things/_enum.json', e => { e.names = ['beta', 'alpha', 'gamma', 'delta']; });
    const r = run(t);
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(ptr(r.image!, 0), ptr(ROM, 1));
    assert.strictEqual(ptr(r.image!, 1), ptr(ROM, 0));
});

test('a thing that changed is built (no G0), others stay home', () => {
    const t = fresh();
    const b = t.get('things/gamma.bin')!.slice(); b[100] ^= 1; t.set('things/gamma.bin', b);
    const r = run(t);
    assert.deepStrictEqual(r.findings.list.map(f => f.rule), ['changed']);
    assert.ok(r.placed.every(p => p.at === p.home));
});

test('an edited base is an error, and no ROM is built', () => {
    const t = fresh();
    const b = t.get('_base/unexploded.bin')!.slice(); b[5] ^= 1; t.set('_base/unexploded.bin', b);
    assert.deepStrictEqual(rules(t), ['base-changed']);
    assert.strictEqual(run(t).image, null);
});

test('a resource the enum lists is missing: error', () => {
    const t = fresh(); t.delete('things/beta.bin');
    assert.deepStrictEqual(rules(t), ['locked-name-missing']);
});

test('a new thing over the limit: error', () => {
    const t = fresh(); t.set('things/epsilon.bin', new Uint8Array([4, 0, 0, 0]));
    assert.deepStrictEqual(rules(t), ['id-over-limit']);
});

test('a thing too big for any free space: error', () => {
    const t = fresh();
    const big = new Uint8Array(0x9000); big.set([0x00, 0x90]); t.set('things/delta.bin', big);
    assert.deepStrictEqual(rules(t), ['no-space']);
});

test('manifest checks still hold: a region gap and the header agreement', () => {
    const t = fresh(); editJson(t, 'manifest.json', m => { m.regions[0].to = '$C2FFFF'; });
    assert.deepStrictEqual(rules(t), ['region-gap']);
    const u = fresh(); editJson(u, 'manifest.json', m => { m.memoryMap.fastRom = false; });
    assert.deepStrictEqual(rules(u), ['header-mismatch']);
});

test('a file no kind owns is a warning; the ROM is still built', () => {
    const t = fresh(); t.set('notes/todo.txt', json('mine'));
    const r = run(t);
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info').map(f => f.rule), ['unknown-file']);
    assert.ok(r.image);
});

test('check-only validates and places without building', () => {
    const r = run(fresh(), { checkOnly: true });
    assert.strictEqual(r.image, null);
    assert.strictEqual(r.findings.failed, false);
});

test('resolveEnum is the same step implode uses', () => {
    const ids = resolveEnum('things/_enum.json', fresh().get('things/_enum.json'), new Set(NAMES), new (class { list = []; error() {} warning() {} info() {} } as any)());
    assert.deepStrictEqual(Object.fromEntries(ids!), { alpha: 0, beta: 1, gamma: 2, delta: 3 });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
