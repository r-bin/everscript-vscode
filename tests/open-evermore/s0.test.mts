// Open Evermore step S0 (docs/open-evermore/progress.md): explode writes manifest.json + raw/, implode rebuilds the
// ROM and validates it (validation.md). Synthetic 3 MiB image with a HiROM/FastROM header; no ROM, no dist/.
// Run: node tests/open-evermore/s0.test.mts
import assert from 'node:assert';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { unclaimed } from '../../tools/open-evermore/raw.mts';
import { json, readText, sha1 } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

function syntheticRom(): Uint8Array {
    const rom = new Uint8Array(3 << 20);
    let x = 0x12345678;
    for (let i = 0; i < rom.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; rom[i] = x & 0xFF; }
    rom[0xFFD5] = 0x31;   // HiROM + FastROM
    rom[0xFFD7] = 0x0C;   // 4 MiB declared
    rom[0xFFD8] = 0x03;   // 8 KiB SRAM
    return rom;
}

const ROM = syntheticRom();
const BASE = { release: 'test', sha1: sha1(ROM), explodedWith: '0.0.0' };
const fresh = (): Tree => explode(ROM, BASE);
const rules = (t: Tree, opts = {}) => implode(t, opts).findings.list.map(f => f.rule);
const editJson = (t: Tree, path: string, edit: (v: any) => void) => { const v = JSON.parse(readText(t.get(path)!)); edit(v); t.set(path, json(v)); };

console.log('\nOpen Evermore S0:');

test('explode writes the manifest and one raw file per bank', () => {
    const t = fresh();
    const banks = [...t.keys()].filter(p => p.endsWith('.bin'));
    assert.strictEqual(banks.length, 48);
    assert.ok(t.has('raw/bank_c0.bin') && t.has('raw/bank_ef.bin') && t.has('raw/_raw.json'));
    const m = JSON.parse(readText(t.get('manifest.json')!));
    assert.deepStrictEqual(m.memoryMap, { layout: 'hirom', size: '3MiB', fastRom: true, sram: '8KiB' });
    assert.deepStrictEqual(m.regions, [{ name: 'rom', from: '$C00000', to: '$EFFFFF', use: 'resources' }]);
});

test('G0: an unchanged tree implodes to the same bytes, with no error and no warning', () => {
    const r = implode(fresh());
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
    assert.ok(r.image && Buffer.from(r.image).equals(Buffer.from(ROM)));
});

test('an edited raw file is an error, and no ROM is built', () => {
    const t = fresh();
    const b = t.get('raw/bank_d0.bin')!.slice(); b[5] ^= 1; t.set('raw/bank_d0.bin', b);
    const r = implode(t);
    assert.deepStrictEqual(r.findings.list.map(f => f.rule), ['raw-changed']);
    assert.strictEqual(r.image, null);
});

test('a raw file and its index both edited: G0 fails, the round trip still holds', () => {
    const t = fresh();
    const b = t.get('raw/bank_d0.bin')!.slice(); b[5] ^= 1; t.set('raw/bank_d0.bin', b);
    editJson(t, 'raw/_raw.json', v => { v.regions.find((r: any) => r.name === 'bank_d0').sha1 = sha1(b); });
    assert.deepStrictEqual(rules(t), ['g0-failed']);
});

test('a missing raw file is an error', () => {
    const t = fresh(); t.delete('raw/bank_c4.bin');
    assert.deepStrictEqual(rules(t), ['missing-file']);
});

test('a missing manifest is an error', () => {
    const t = fresh(); t.delete('manifest.json');
    assert.deepStrictEqual(rules(t), ['missing-file']);
});

test('regions must cover the image: a gap is an error', () => {
    const t = fresh();
    editJson(t, 'manifest.json', m => { m.regions[0].to = '$EEFFFF'; });
    assert.deepStrictEqual(rules(t), ['region-gap']);
});

test('only hirom for now', () => {
    const t = fresh();
    editJson(t, 'manifest.json', m => { m.memoryMap.layout = 'exhirom'; });
    assert.deepStrictEqual(rules(t), ['unsupported-layout']);
});

test('the manifest and the built header must agree', () => {
    const t = fresh();
    editJson(t, 'manifest.json', m => { m.memoryMap.fastRom = false; });
    assert.deepStrictEqual(rules(t), ['header-mismatch']);
});

test('a reserved region without a reason is a schema error', () => {
    const t = fresh();
    editJson(t, 'manifest.json', m => { m.regions = [{ name: 'a', from: '$C00000', to: '$C0FFFF', use: 'reserved' }, { name: 'b', from: '$C10000', to: '$EFFFFF', use: 'resources' }]; });
    assert.deepStrictEqual(rules(t), ['schema']);
});

test('a raw write into a reserved region is an error', () => {
    const t = fresh();
    editJson(t, 'manifest.json', m => { m.regions = [{ name: 'a', from: '$C00000', to: '$C0FFFF', use: 'reserved', why: 'test' }, { name: 'b', from: '$C10000', to: '$EFFFFF', use: 'resources' }]; });
    assert.deepStrictEqual(rules(t), ['wrong-region']);
});

test('a file no kind owns is a warning; the ROM is still built', () => {
    const t = fresh(); t.set('notes/todo.txt', json('mine'));
    const r = implode(t);
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info').map(f => f.rule), ['unknown-file']);
    assert.ok(r.image);
});

test('--check-only validates without building', () => {
    const r = implode(fresh(), { checkOnly: true });
    assert.strictEqual(r.image, null);
    assert.strictEqual(r.findings.failed, false);
});

test('raw keeps what other kinds did not claim, cut at bank boundaries', () => {
    assert.deepStrictEqual(unclaimed(0x30000, [{ start: 0x8000, end: 0x18000 }]), [
        { start: 0, end: 0x8000 }, { start: 0x18000, end: 0x20000 }, { start: 0x20000, end: 0x30000 },
    ]);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
