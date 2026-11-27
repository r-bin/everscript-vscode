// The wram kind (docs/open-evermore/wram.md §0): explode writes every named variable as one file per part of WRAM by
// meaning (an ordered list; the parts and regions in the mapping file's memory.wram), implode places them back by order and
// size, lets a part spill into the next, resizes items with their enum, moves what the reader census can rewrite (writing
// its operands), and refuses by name what it cannot.
// Run: node tests/open-evermore/wram.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import type { ImplodeContext } from '../../tools/open-evermore/codec.mts';
import { Findings } from '../../tools/open-evermore/findings.mts';
import { json, readText } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';
import * as map from '../../tools/open-evermore/evermore/map.mts';
import { noteNumberedCell, vanillaWram, wramAddress, wramCodec, wramName, wramSize, wramVanilla } from '../../tools/open-evermore/evermore/codecs/wram.mts';
import { wramAt, wramText } from '../../tools/open-evermore/evermore/codecs/records.mts';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓ ' + name); };
console.log('\nOpen Evermore wram kind:');

const fresh = (): Tree => wramCodec.explode(new Uint8Array(0), (k, id) => `${k}_${id}`, {}, () => undefined, () => undefined).files;
const encode = (tree: Tree, extra: Partial<ImplodeContext> = {}) => {
    const ctx = { tree, findings: new Findings(), ...extra } as unknown as ImplodeContext;
    wramCodec.encode(ctx, wramCodec.names(ctx));
    return ctx;
};
const rules = (ctx: ImplodeContext) => ctx.findings.list.filter(f => f.severity === 'error').map(f => f.rule);
const PARTS = map.memory('wram').flatMap(r => r.parts.map(p => p.name));
const edit = (tree: Tree, file: string, change: (f: any) => void) => { const f = JSON.parse(readText(tree.get(`wram/${file}.json`)!)); change(f); tree.set(`wram/${file}.json`, json(f)); };
const items = (tree: Tree, part: string): any[] => JSON.parse(readText(tree.get(`wram/${part}.json`)!)).items;
const item = (list: any[], name: string) => list.find(i => i.name === name || i.cells?.some((c: any) => c.name === name));
const partOf = (tree: Tree, name: string) => PARTS.find(p => item(items(tree, p), name))!;
/** The operand bytes implode writes for the census site of a group starting at `from` (vanilla bus address). */
const operandsAt = (ctx: ImplodeContext) => new Map(wramCodec.tables(ctx, new Map()).map(w => [w.at, w.bytes]));

test('explode: a file per part by meaning, every variable in one, back at its vanilla place (lossless)', () => {
    const tree = fresh(), list = vanillaWram();
    assert.deepStrictEqual([...tree.keys()].filter(k => !k.includes('/_')).sort(), PARTS.map(p => `wram/${p}.json`).sort());
    assert.ok(PARTS.length > 40, `${PARTS.length} parts`);
    assert.ok(tree.has('wram/_types.json'));
    assert.strictEqual(new Set(list.map(v => v.name)).size, list.length);
    const ctx = encode(tree);
    assert.deepStrictEqual(rules(ctx), []);
    for (const v of list) assert.strictEqual(wramAddress(v.name), v.at, v.name);
    assert.ok(!wramCodec.changed!(), 'nothing moved');
    assert.deepStrictEqual(wramCodec.memoryMoves!(), []);
    const f = JSON.parse(readText(tree.get('wram/mode7.json')!));
    assert.strictEqual(f.region, 'low');
    assert.match(f.what, /Mode 7/);
});

test('an item is a type and a count; a cell inside an item is named in its cells; temp[] reads as temp[n]', () => {
    const tree = fresh();
    assert.deepStrictEqual(item(items(tree, 'effects'), 'PROJ_ALCHEMY_SLOTS_BASE'), { name: 'PROJ_ALCHEMY_SLOTS_BASE', type: 'ProjAlchemySlot', count: 8 });
    assert.deepStrictEqual(item(items(tree, 'session'), 'CHOICE_PROMPT_STATE'), { name: 'CHOICE_PROMPT_STATE', type: 'ChoiceBoxState' });
    const inner = vanillaWram().find(v => v.in)!;
    assert.strictEqual(item(items(tree, partOf(tree, inner.name)), inner.name).name, inner.in);
    assert.deepStrictEqual(items(tree, 'temp'), [{ name: 'TEMP_COMPILER_ARENA', type: 'u8', count: 200 }]);
    encode(tree);
    assert.strictEqual(wramName(wramAddress('TEMP_COMPILER_ARENA')!), '', 'temp[] cells read as temp[n], never by the block\'s name');
});

test('implode of a fresh tree writes every census operand at its vanilla value', () => {
    const ctx = encode(fresh()), w = operandsAt(ctx);
    assert.ok(w.size > 3000, `${w.size} operands`);
    // FRAME_COUNTER_1 ($7E:0100) is read at $C0:8462 with a 16-bit operand.
    assert.deepStrictEqual([...w.get(0x008463)!], [0x00, 0x01]);
});

test('a rename: the other kinds read the new name at the same address', () => {
    const at = wramAddress('ENEMY_SPAWNER_QUANTITY')!, tree = fresh();
    edit(tree, partOf(tree, 'ENEMY_SPAWNER_QUANTITY'), f => { const i = item(f.items, 'ENEMY_SPAWNER_QUANTITY'); if (i.name === 'ENEMY_SPAWNER_QUANTITY') i.name = 'SPAWN_COUNT'; else i.cells.find((c: any) => c.name === 'ENEMY_SPAWNER_QUANTITY').name = 'SPAWN_COUNT'; });
    assert.deepStrictEqual(rules(encode(tree)), []);
    assert.strictEqual(wramAddress('SPAWN_COUNT'), at);
    assert.strictEqual(wramAddress('ENEMY_SPAWNER_QUANTITY'), undefined);
    assert.strictEqual(wramAt('SPAWN_COUNT'), at & 0xFFFF);
    assert.strictEqual(wramText(at & 0xFFFF), 'SPAWN_COUNT');
    assert.ok(!wramCodec.changed!());
});

test('an enum resized and given a value: its items grow, what follows moves and its operands are rewritten', () => {
    const tree = fresh();
    edit(tree, '_types', t => { t.enums.ChoiceBoxState.size = 4; t.enums.ChoiceBoxState.values['0x04'] = 'CANCELLED'; });
    edit(tree, 'session', f => { item(f.items, 'DIALOGUE_SCROLL_ALIGN_GAP').count = 20; });
    const ctx = encode(tree);
    assert.deepStrictEqual(rules(ctx), []);
    assert.strictEqual(wramSize('CHOICE_PROMPT_STATE'), 4);
    assert.strictEqual(wramAddress('SAVE_MENU_SRAM_PTR'), 0x7E0B37 + 2, 'after the enum: 2 bytes on');
    assert.strictEqual(wramAddress('DIALOGUE_SCROLL_TIMER'), 0x7E0B6F, 'after the shrunk gap: home');
    assert.strictEqual(wramVanilla(0x7E0B39), 0x7E0B37, 'a moved cell is known by its vanilla place');
    assert.ok(wramCodec.changed!());
    assert.ok(wramCodec.memoryMoves!().some(m => m.a === 0x0B37 && m.b === 0x0B39 && m.length === 2));
    // SAVE_MENU_SRAM_PTR's 29 operands now name $0B39.
    const w = operandsAt(ctx), census = map.wramCensus() as any;
    for (const [pc] of census.movable['$7E:0B37+2']) assert.deepStrictEqual([...w.get((parseInt(pc.replace(/[$:]/g, ''), 16) & 0x3FFFFF) + 1)!].slice(0, 2), [0x39, 0x0B], pc);
    edit(tree, '_types', t => { t.enums.ChoiceBoxState.values['0x1FFFFFFFF'] = 'HUGE'; t.enums.ChoiceBoxState.values['0x05'] = 'bad name'; });
    assert.deepStrictEqual(rules(encode(tree)).sort(), ['bad-name', 'schema']);
});

test('a part that grows spills into the next ones, pushing them, until a gap or a removed pad takes it', () => {
    const tree = fresh();
    edit(tree, 'room_animation', f => { item(f.items, 'TERRAIN_COUNTDOWNS').count = 82; });
    edit(tree, 'mode7', f => { assert.strictEqual(f.items[0].name, 'MODE7_CAMERA_ALIGN_PAD'); f.items.shift(); });
    const ctx = encode(tree);
    assert.deepStrictEqual(rules(ctx), []);
    assert.strictEqual(wramAddress('PALETTE_SLOT_1'), 0x7E1278 + 2, 'sprite_cache pushed');
    assert.strictEqual(wramAddress('DOG_FORM_SCENT_RADIUS'), 0x7E144D + 2, 'actors pushed');
    assert.strictEqual(wramAddress('MODE7_CAMERA_PAN_MAX_SPEED'), 0x7E1474, 'mode7 lost its pad: home again');
    assert.ok(!wramCodec.memoryMoves!().some(m => m.a === 0x1472 && m.b >= 0), 'the pad nothing reads is gone, no error');
});

test('refused by name: a pinned variable moved, a group split, the low mirror left, a saved block entered', () => {
    let tree = fresh();
    edit(tree, 'ring', f => f.items.unshift({ gap: 2 }));
    let ctx = encode(tree);
    assert.ok(rules(ctx).includes('wram-pinned'));
    assert.match(ctx.findings.list.find(f => f.rule === 'wram-pinned')!.message, /cannot move .*: \$/);
    tree = fresh();
    edit(tree, 'sprite_cache', f => { const k = f.items.findIndex((i: any) => i.name === 'PALETTE_SLOT_1'); [f.items[k], f.items[k + 1]] = [f.items[k + 1], f.items[k]]; });
    assert.ok(rules(encode(tree)).includes('wram-group-split'), 'the palette slots are one group');
    tree = fresh();
    edit(tree, 'raster', f => f.items.push({ name: 'PAST_THE_MIRROR', type: 'u16', count: 64 }));
    assert.ok(rules(encode(tree)).includes('wram-reach'), 'low WRAM is reached through the mirror, which ends at $1FFF');
    tree = fresh();
    edit(tree, 'party', f => { const k = f.items.findIndex((i: any) => i.name === 'TALONS_AMOUNT' || i.cells?.some((c: any) => c.name === 'TALONS_AMOUNT')); f.items.splice(k, 0, { name: 'NEW_COUNTER', type: 'u16' }); });
    assert.ok(rules(encode(tree)).includes('wram-save-block'), 'a new variable in the saved party block');
});

test('a script cell written as a number pins the variable it names', () => {
    const tree = fresh();
    edit(tree, 'session', f => { item(f.items, 'CHOICE_PROMPT_STATE').size = 4; item(f.items, 'DIALOGUE_SCROLL_ALIGN_GAP').count = 20; });
    const ctx = encode(tree);
    noteNumberedCell(0x7E0B37);
    wramCodec.tables(ctx, new Map());
    assert.ok(rules(ctx).includes('wram-script-number'));
});

test('prove\'s original keeps the tree\'s names at vanilla\'s places', () => {
    const tree = fresh();
    edit(tree, 'session', f => { item(f.items, 'CHOICE_PROMPT_STATE').size = 4; item(f.items, 'DIALOGUE_SCROLL_ALIGN_GAP').count = 20; });
    encode(tree, { vanillaMemory: true });
    assert.strictEqual(wramAddress('SAVE_MENU_SRAM_PTR'), 0x7E0B37);
    assert.ok(!wramCodec.changed!());
});

test('broken files are named', () => {
    let tree = fresh();
    edit(tree, 'frame', f => { f.items[0].type = 'NoSuchType'; f.items[1].name = f.items[2].name; });
    assert.ok(['duplicate-name', 'unknown-type'].every(r => rules(encode(tree)).includes(r)));
    tree = fresh();
    tree.delete('wram/temp.json');
    tree.set('wram/RNG_SEED_0.json', json({}));
    const f = encode(tree).findings;
    assert.ok(f.list.some(x => x.rule === 'missing-file'));
    assert.ok(f.list.some(x => x.rule === 'unknown-file'));
});

encode(fresh());
console.log(`\n${passed} passed`);
