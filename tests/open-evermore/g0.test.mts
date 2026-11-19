// Open Evermore on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library, then
// implode the tree in memory: stable gives the vanilla sha1 with no warning (G0), also with the families as PNGs;
// two random layouts (grown to 4 MiB) and an ExHiROM and SA-1 one place every room, the family array and every tile, rewrite their tables and
// explode back to the same tree; an edited room is compressed anew; cross-kind references, colours and pixels are
// checked. Playing them is `open-evermore.mts prove` (on demand: never in a tier). Skips without the ROM.
// Run: node tests/open-evermore/g0.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GAME, KINDS, PAST_END } from '../../tools/open-evermore/evermore/kinds.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { sha1 } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { stripCopierHeader } = require('../../dist/platform/roms/header');
const { encodePng } = require('../../dist/platform/png');

const path = games.baseRomPath('evermore');
if (!path || !existsSync(path)) {
    console.log('\nOpen Evermore G0: skipped (no Evermore base ROM in the ROM library)');
} else {
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(path)));
    const tree = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS);
    console.log('\nOpen Evermore on the base ROM:');

    const stable = implode(tree, GAME, KINDS);
    assert.deepStrictEqual(stable.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(stable.sha1, sha1(rom));
    console.log(`  ✓ stable: ${tree.size} files → the same ROM (${stable.sha1}), no warnings`);

    for (const seed of [1, 2026]) {
        const r = implode(tree, GAME, KINDS, { seed });
        assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
        const moved = r.placed.filter(p => p.at !== p.home).length;
        assert.ok(moved > 100, `only ${moved} rooms moved`);
        const families = r.placed.find(p => p.key === 'tile_families/array')!;
        assert.strictEqual(r.image!.length, 0x400000, 'a random layout grows the image to 4 MiB');
        const fourth = r.placed.filter(p => p.at >= 0x300000).length;
        console.log(`  ✓ random ${seed}: ${moved} of ${r.placed.length} resources moved, ${fourth} into the 4th MB (tile families ${families.at === families.home ? 'stayed' : 'moved'}), tables rewritten, round trip holds`);
    }

    const rules = (edit: (t: typeof tree) => void) => {
        const t = new Map(tree);
        edit(t);
        return implode(t, GAME, KINDS).findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}#${f.pointer}`);
    };
    const editJson = (t: typeof tree, path: string, fn: (v: any) => void) => {
        const v = JSON.parse(Buffer.from(t.get(path)!).toString()); fn(v); t.set(path, new Uint8Array(Buffer.from(JSON.stringify(v))));
    };
    const room = [...tree.keys()].find(p => p.startsWith('maps/') && p.endsWith('/map.json'))!;
    assert.deepStrictEqual(rules(t => editJson(t, room, m => { m.tileFamilies[0] = 'no_such_family'; })), [`unknown-reference ${room}#/tileFamilies/0`]);
    assert.deepStrictEqual(rules(t => editJson(t, 'tile_families/family_000.json', f => { f.colours[3] = '#123456'; })), ['invalid-value tile_families/family_000.json#/colours/3']);
    assert.deepStrictEqual(rules(t => editJson(t, room, m => { m.graphics.tiles[0] = 'no_such_tile'; })), [`unknown-reference ${room}#/graphics/tiles/0`]);
    const rgb = new Uint8Array(encodePng(16, 16, new Uint8Array(16 * 16 * 4).fill(255)));
    assert.deepStrictEqual(rules(t => { t.set('tiles/tile_0000.png', rgb); }), ['invalid-value tiles/tile_0000.png#']);
    console.log('  ✓ a map naming a missing family or tile, a colour the SNES cannot show and a tile PNG that is not indexed are errors');

    const meta = room.replace('map.json', 'metatiles.json'), grid = room.replace('map.json', 'grid.txt');
    assert.deepStrictEqual(rules(t => editJson(t, meta, m => { m.list[0].collision += ' sticky'; })), [`invalid-value ${meta}#/list/0/collision`]);
    assert.deepStrictEqual(rules(t => { t.set(grid, new TextEncoder().encode('000 001\n000\n')); }), [`invalid-value ${grid}#/1`]);
    console.log('  ✓ an unknown collision flag and a ragged grid.txt are errors');

    // An edited metatile: the room is compressed anew, the ROM still builds and explodes back to the edit.
    const edited = new Map(tree);
    editJson(edited, meta, m => { const c: string = m.list[0].collision; m.list[0].collision = c.includes('front') ? c.replace(' front', '') : c + ' front'; });
    const e = implode(edited, GAME, KINDS);
    assert.deepStrictEqual(e.findings.list.filter(f => f.severity === 'error'), []);
    assert.notStrictEqual(e.sha1, sha1(rom));
    console.log('  ✓ an edited metatile is compressed anew and round-trips');

    const other = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS, undefined, { tile_families: { format: 'png' }, tiles: { format: 'json' } });
    assert.ok(other.has('tile_families/family_000.png') && other.has('tiles/tile_0000.json'));
    const p = implode(other, GAME, KINDS);
    assert.deepStrictEqual(p.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(p.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => { t.delete('tiles/tile_0000.png'); t.set('tiles/tile_0000.json', other.get('tiles/tile_0000.json')!); }), []);
    console.log('  ✓ families as PNG stripes and tiles as JSON rows: the same ROM; one tile as JSON among PNGs too');

    for (const layout of ['exhirom', 'sa1']) {
        const t = new Map(tree);
        editJson(t, 'manifest.json', m => { m.memoryMap.layout = layout; m.memoryMap.size = '8MiB'; });
        const r = implode(t, GAME, KINDS, { seed: 3, pastEnd: PAST_END });
        assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), [], layout);
        assert.strictEqual(r.image!.length, 0x800000);
        const second = r.placed.filter(p => p.at >= 0x400000).length;
        if (layout === 'exhirom') assert.ok(second > 100, `only ${second} resources in the second 4 MB`);
        console.log(`  ✓ ${layout}: an 8 MiB image, round trip holds${layout === 'exhirom' ? `, ${second} resources in $41-$7D` : ''}`);
    }
}
