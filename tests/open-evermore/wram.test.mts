// The wram kind (docs/open-evermore/wram.md §0, memory.md §4.2): explode writes every named variable as region files (an
// ordered list per region of the mapping file's memory.wram), implode places them back by order and size and hands their
// addresses to the other kinds; a rename is free, a move or resize is an error until WRAM moves (todo W2).
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
const REGIONS = ['direct_page', 'low', 'system', 'save', 'temp', 'room', 'bank_7f'];
const items = (tree: Tree, region: string): any[] => JSON.parse(readText(tree.get(`wram/${region}.json`)!)).items;
const setItems = (tree: Tree, region: string, change: (items: any[]) => void) => {
    const f = JSON.parse(readText(tree.get(`wram/${region}.json`)!));
    change(f.items);
    tree.set(`wram/${region}.json`, json(f));
};
const item = (list: any[], name: string) => list.find(i => i.name === name || i.cells?.some((c: any) => c.name === name));

test('explode: a file per region, every variable in one, back at its vanilla place (lossless)', () => {
    const tree = fresh(), list = vanillaWram();
    assert.deepStrictEqual([...tree.keys()].filter(k => !k.includes('/_')).sort(), REGIONS.map(r => `wram/${r}.json`).sort());
    assert.ok(tree.has('wram/_types.json'));
    assert.ok(list.length > 1000, `${list.length} variables`);
    assert.strictEqual(new Set(list.map(v => v.name)).size, list.length);
    const f = encode(tree);
    assert.strictEqual(f.list.length, 0, f.list.map(x => x.message).join('\n'));
    for (const v of list) assert.strictEqual(wramAddress(v.name), v.at, v.name);
});

test('an item is a type and a count; a cell inside an item is named in its cells', () => {
    const room = items(fresh(), 'room');
    assert.deepStrictEqual(item(room, 'PROJ_ALCHEMY_SLOTS_BASE'), { name: 'PROJ_ALCHEMY_SLOTS_BASE', type: 'ProjAlchemySlot', count: 8 });
    const inner = vanillaWram().find(v => v.in)!;
    assert.ok(Object.values(Object.fromEntries(REGIONS.map(r => [r, items(fresh(), r)]))).some(l => item(l, inner.name)?.name === inner.in), inner.name);
    assert.deepStrictEqual(items(fresh(), 'temp'), [{ name: 'TEMP_COMPILER_ARENA', type: 'u8', count: 200 }]);
    assert.strictEqual(wramName(wramAddress('TEMP_COMPILER_ARENA')!), '', 'temp[] cells read as temp[n], never by the block\'s name');
});

test('implode of a fresh tree: no finding, the vanilla layout', () => {
    assert.strictEqual(encode(fresh()).list.length, 0);
    assert.strictEqual(wramName(wramAddress('ENEMY_SPAWNER_QUANTITY')!), 'ENEMY_SPAWNER_QUANTITY');
});

test('a rename: the other kinds read the new name at the same address', () => {
    const at = wramAddress('ENEMY_SPAWNER_QUANTITY')!, tree = fresh();
    const region = REGIONS.find(r => item(items(tree, r), 'ENEMY_SPAWNER_QUANTITY'))!;
    setItems(tree, region, l => { const i = l.find(x => x.name === 'ENEMY_SPAWNER_QUANTITY'); if (i) i.name = 'SPAWN_COUNT'; else for (const x of l) for (const c of x.cells ?? []) if (c.name === 'ENEMY_SPAWNER_QUANTITY') c.name = 'SPAWN_COUNT'; });
    assert.strictEqual(encode(tree).list.length, 0);
    assert.strictEqual(wramAddress('SPAWN_COUNT'), at);
    assert.strictEqual(wramAddress('ENEMY_SPAWNER_QUANTITY'), undefined);
    assert.strictEqual(wramAt('SPAWN_COUNT'), at & 0xFFFF);
    assert.strictEqual(wramText(at & 0xFFFF), 'SPAWN_COUNT');
});

test('owner\'s checks: temp[] shrunk, a 9th projectile alchemy slot: refused by name until W2, nothing else blamed', () => {
    let tree = fresh();
    setItems(tree, 'temp', l => { l[0].count = 100; l.push({ gap: 100 }); });
    let f = encode(tree);
    assert.deepStrictEqual(f.list.map(x => x.rule), ['wram-resized']);
    assert.match(f.list[0].message, /TEMP_COMPILER_ARENA at \$7E:2834 is 100 bytes, vanilla's 200/);
    tree = fresh();
    setItems(tree, 'room', l => { l.find(x => x.name === 'PROJ_ALCHEMY_SLOTS_BASE').count = 9; });
    f = encode(tree);
    assert.ok(f.list.some(x => x.rule === 'wram-resized' && /PROJ_ALCHEMY_SLOTS_BASE at \$7E:3564 is 1062 bytes, vanilla's 944/.test(x.message)));
    assert.ok(f.list.some(x => x.rule === 'wram-moved' && /PROJ_ALCHEMY_ALIGN_PAD → \$7E:398A/.test(x.message)));
    assert.ok(f.list.some(x => x.rule === 'wram-region-full'), 'the room region ends at $7E:FFFF: the last items would leave bank $7E');
    assert.ok(!f.list.some(x => x.rule === 'wram-resized' && !/PROJ_ALCHEMY_SLOTS_BASE/.test(x.message)), 'a shifted variable is moved, not resized');
});

test('a move is an error (a gap before a variable), and so are broken files', () => {
    let tree = fresh();
    setItems(tree, 'low', l => l.splice(1, 0, { gap: 2 }));
    assert.ok(encode(tree).list.some(f => f.rule === 'wram-moved'));
    tree = fresh();
    setItems(tree, 'low', l => { l[0].type = 'NoSuchType'; l[1].name = l[2].name; });
    assert.deepStrictEqual(encode(tree).list.map(f => f.rule).sort().filter((r, k, a) => a.indexOf(r) === k), ['duplicate-name', 'unknown-type', 'wram-moved']);
    tree = fresh();
    tree.delete('wram/temp.json');
    tree.set('wram/RNG_SEED_0.json', json({}));
    const f = encode(tree);
    assert.ok(f.list.some(x => x.rule === 'missing-file'));
    assert.ok(f.list.some(x => x.rule === 'unknown-file'));
});

encode(fresh());
console.log(`\n${passed} passed`);
