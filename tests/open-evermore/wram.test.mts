// The wram kind (docs/open-evermore/wram.md): explode writes every named variable, implode reads them back and hands
// their addresses to the other kinds; a rename is free, a move is an error until WRAM moves (todo W2).
// Run: node tests/open-evermore/wram.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import type { ImplodeContext } from '../../tools/open-evermore/codec.mts';
import { Findings } from '../../tools/open-evermore/findings.mts';
import { json, readText } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';
import { vanillaWram, wramAddress, wramCodec, wramName } from '../../tools/open-evermore/evermore/codecs/wram.mts';
import { wramAt, wramText } from '../../tools/open-evermore/evermore/codecs/records.mts';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓ ' + name); };
console.log('\nOpen Evermore wram kind:');

const fresh = (): Tree => wramCodec.explode(new Uint8Array(0), (k, id) => `${k}_${id}`, {}, () => undefined, () => undefined).files;
const encode = (tree: Tree) => {
    const ctx = { tree, findings: new Findings() } as unknown as ImplodeContext;
    wramCodec.encode(ctx, wramCodec.names(ctx));
    return ctx.findings;
};
const edit = (tree: Tree, name: string, change: (v: any) => void, to = name) => {
    const v = JSON.parse(readText(tree.get(`wram/${name}.json`)!));
    change(v);
    tree.delete(`wram/${name}.json`);
    tree.set(`wram/${to}.json`, json(v));
};

test('explode: one file per named variable, names unique, places by at or in + offset', () => {
    const tree = fresh(), list = vanillaWram();
    assert.ok(list.length > 1000, `${list.length} variables`);
    assert.strictEqual(new Set(list.map(v => v.name)).size, list.length);
    assert.deepStrictEqual(JSON.parse(readText(tree.get('wram/ENEMY_SPAWNER_QUANTITY.json')!)).at, '$7E:' + (wramAddress('ENEMY_SPAWNER_QUANTITY')! & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'));
    const inner = list.find(v => v.in)!;
    assert.strictEqual(JSON.parse(readText(tree.get(`wram/${inner.name}.json`)!)).in, inner.in);
});

test('implode of a fresh tree: no finding, the vanilla layout', () => {
    assert.strictEqual(encode(fresh()).list.length, 0);
    assert.strictEqual(wramName(wramAddress('ENEMY_SPAWNER_QUANTITY')!), 'ENEMY_SPAWNER_QUANTITY');
});

test('a rename: the other kinds read the new name at the same address', () => {
    const at = wramAddress('ENEMY_SPAWNER_QUANTITY')!, tree = fresh();
    edit(tree, 'ENEMY_SPAWNER_QUANTITY', () => {}, 'SPAWN_COUNT');
    assert.strictEqual(encode(tree).list.length, 0);
    assert.strictEqual(wramAddress('SPAWN_COUNT'), at);
    assert.strictEqual(wramAddress('ENEMY_SPAWNER_QUANTITY'), undefined);
    assert.strictEqual(wramAt('SPAWN_COUNT'), at & 0xFFFF);
    assert.strictEqual(wramText(at & 0xFFFF), 'SPAWN_COUNT');
});

test('a move is an error (onto a free place or another variable\'s), and so is a broken file', () => {
    const other = vanillaWram().find(v => !v.in && v.size === 2 && v.name !== 'ENEMY_SPAWNER_QUANTITY')!;
    for (const at of ['$7E:1FFE', '$7E:' + (other.at & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')]) {
        const tree = fresh();
        edit(tree, 'ENEMY_SPAWNER_QUANTITY', v => { v.at = at; v.size = 2; });
        assert.ok(encode(tree).list.some(f => f.rule === 'wram-moved'), at);
    }
    const tree = fresh();
    edit(tree, 'ENEMY_SPAWNER_QUANTITY', v => { v.at = '7E0133'; });
    edit(tree, 'RNG_SEED_0', v => { delete v.at; v.in = 'NO_SUCH_VARIABLE'; v.offset = 0; });
    assert.deepStrictEqual(encode(tree).list.map(f => f.rule).sort(), ['schema', 'unknown-name']);
});

encode(fresh());
console.log(`\n${passed} passed`);
