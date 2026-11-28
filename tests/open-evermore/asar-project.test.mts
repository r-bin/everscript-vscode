// Standalone Asar project generator (tools/open-evermore/asar-project.mts): synthetic unit test verifying
// enums.asm, wram.asm, symbols.asm, blobs/, and main.asm generation without requiring a ROM.
// Run: node tests/open-evermore/asar-project.test.mts (npm run build:ts first).
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { buildAsarProject, enumDefines, resourceSymbol } from '../../tools/open-evermore/asar-project.mts';
import type { Codec, ImplodeContext, Item, Write } from '../../tools/open-evermore/codec.mts';
import { Findings } from '../../tools/open-evermore/findings.mts';
import { plan } from '../../tools/open-evermore/layouts.mts';
import { readText, text } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const asm = require('../../dist/platform/snes/asm65816');

console.log('\nAsar project generator:');

assert.strictEqual(resourceSymbol('maps/_table'), 'tbl_maps_table');
assert.strictEqual(resourceSymbol('maps/antiqua_pyramid_outside'), 'res_maps_antiqua_pyramid_outside');
assert.strictEqual(resourceSymbol('animations/boy/walk#north'), 'res_animations_boy_walk_north');

const ids = new Map<string, Map<string, number>>([
    ['maps', new Map([['first_room', 0], ['second_room', 1]])],
    ['items', new Map([['petal', 0], ['nectar', 1], ['honey', 2]])],
]);
const defs = enumDefines(ids);
assert.strictEqual(defs.get('MAPS_COUNT'), 2);
assert.strictEqual(defs.get('MAPS_SECOND_ROOM'), 1);
assert.strictEqual(defs.get('ITEMS_COUNT'), 3);
assert.strictEqual(defs.get('ITEMS_HONEY'), 2);
console.log('  ✓ resourceSymbol and enumDefines format table, resource, count, and id symbols');

const mockWramCodec: Codec = {
    kind: 'wram', version: 1, path: 'wram', defaultName: id => `wram_${id}`,
    explode: () => ({ files: new Map(), pool: [], tables: [], homes: [] }),
    names: () => new Set(),
    encode: () => [],
    tables: () => [],
    defines: () => ({
        labels: new Map([['BOY_HP', 0x7E0A3D], ['FRAME_COUNTER', 0x7E0100]]),
        defines: new Map([['ENUM_Direction_UP', 0], ['STRUCT_EntityRecord_hp', 0x1C]]),
    }),
};

const baseImage = new Uint8Array(0x300000).fill(0xFF);
baseImage[0xFFD7] = 0x0C;
const base = {
    image: baseImage, pool: [], tables: [], homes: new Map(), homeSha1: new Map(), enumSha1: new Map(),
};
const p = plan('hirom', 0x400000, baseImage.length, []);
const ctx = {
    tree: new Map(), manifest: {} as any, size: 0x400000, base, findings: new Findings(),
    ids, marks: new Map(), pointer: p.pointer, names: new Map(), symbols: new Map([['maps/_table', 0x058000]]),
    random: false, strict: false,
} as ImplodeContext;

const items: Item[] = [
    { key: 'maps/first_room', file: 'maps/rooms/first_room/map.json', bytes: Uint8Array.of(1, 2, 3, 4), rule: {} },
    { key: 'code/my_func', file: 'code/my_func.asm', bytes: Uint8Array.of(0xA9, 0x02, 0x00, 0x6B), rule: { upperHalf: true }, patched: true, holes: [{ start: 1, end: 2 }] },
];
const placed = new Map<string, number>([
    ['maps/first_room', 0x300000],
    ['maps/_table', 0x058000],
    ['code/my_func', 0x308000],
]);
const writes: Write[] = [
    { at: 0x058000, bytes: Uint8Array.of(0x00, 0x00, 0xF0), file: 'maps/_enum.json' },
    // Patch inside code/my_func hole (must land in blobs/patches.bin after code incsrc).
    { at: 0x308001, bytes: Uint8Array.of(0x77), file: 'characters/_records.json' },
];
const codeFiles = new Map([['my_func', 'code/my_func.asm']]);

const asar = buildAsarProject({ base, plan: p, kinds: [mockWramCodec], ctx, items, placed, writes, codeFiles });

const enumsAsm = readText(asar.get('enums.asm')!);
const wramAsm = readText(asar.get('wram.asm')!);
const symbolsAsm = readText(asar.get('symbols.asm')!);
const mainAsm = readText(asar.get('main.asm')!);

assert.match(enumsAsm, /!MAPS_COUNT = \$02/);
assert.match(enumsAsm, /!ENUM_Direction_UP = \$00/);
assert.match(enumsAsm, /!STRUCT_EntityRecord_hp = \$1C/);
assert.match(wramAsm, /BOY_HP = \$7E0A3D/);
assert.match(symbolsAsm, /res_maps_first_room = \$F00000/);
assert.match(symbolsAsm, /tbl_maps_table = \$858000/);
assert.match(mainAsm, /^hirom$/m);
assert.match(mainAsm, /incsrc "enums\.asm"/);
assert.match(mainAsm, /incsrc "wram\.asm"/);
assert.match(mainAsm, /incsrc "symbols\.asm"/);
assert.match(mainAsm, /org \$B08000\nincsrc "\.\.\/\.\.\/code\/my_func\.asm"/);
assert.match(mainAsm, /; Non-symbolized patches inside code holes\norg \$F08001 : incbin "blobs\/patches\.bin":0-1/);
assert.ok(asar.has('blobs/base.bin') && asar.has('blobs/maps.bin') && asar.has('blobs/patches.bin'));

// Verify our built-in assembler resolves symbols from the generated enums/wram/symbols headers.
const symLookup = new Map<string, number>();
for (const line of [enumsAsm, wramAsm, symbolsAsm].join('\n').split('\n')) {
    const m = /^(!?[A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$([0-9A-F]+)$/.exec(line.trim());
    if (m) symLookup.set(m[1], parseInt(m[2], 16));
}
const errs: any[] = [];
const prog = asm.measure('test.asm', 'my_func:\n    lda.w #!MAPS_COUNT\n    sta.w BOY_HP\n    lda.l tbl_maps_table,x\n    rtl\n', errs);
const bytes = asm.encode(prog, 0xB08000, (s: string) => symLookup.get(s), errs);
assert.deepStrictEqual(errs, []);
assert.deepStrictEqual([...bytes], [0xA9, 0x02, 0x00, 0x8D, 0x3D, 0x0A, 0xBF, 0x00, 0x80, 0x85, 0x6B]);
console.log('  ✓ buildAsarProject emits valid main.asm, enums.asm, wram.asm, symbols.asm, blobs/, and post-code patches');
