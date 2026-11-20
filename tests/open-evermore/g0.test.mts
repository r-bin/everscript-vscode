// Open Evermore on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library, then
// implode the tree in memory: stable gives the vanilla sha1 with no warning (G0), also with the families as PNGs;
// two random layouts (grown to 4 MiB) and an ExHiROM and SA-1 one place every room, the family array and every tile, rewrite their tables and
// explode back to the same tree; an edited room, object and grass record are compressed anew; cross-kind references, colours and pixels are
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

    // Objects and cuttable grass are text (map format v6): an edited state and an edited grass record build and
    // explode back to the edit; a token that is no metatile is an error at its row.
    const grassRoom = [...tree.keys()].find(p => p.endsWith('/map.json') && JSON.parse(Buffer.from(tree.get(p)!).toString()).cuttableGrass.length)!;
    const objects = grassRoom.replace('map.json', 'objects.json');
    const changed = new Map(tree);
    editJson(changed, objects, o => { const st = o.list[0].states[0]; st.cells[0] = st.cells[0].replace(/^\s*[0-9a-f]+/, '000'); });
    editJson(changed, grassRoom, m => { m.cuttableGrass[0].into = [m.cuttableGrass[1].into[0]]; });
    const c = implode(changed, GAME, KINDS);
    assert.deepStrictEqual(c.findings.list.filter(f => f.severity === 'error'), []);
    assert.notStrictEqual(c.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => editJson(t, objects, o => { const st = o.list[0].states[0]; st.cells[0] = st.cells[0].replace(/^\s*\S+/, 'zzz'); })), [`invalid-value ${objects}#/list/0/states/0/cells/0`]);
    assert.deepStrictEqual(rules(t => editJson(t, grassRoom, m => { m.cuttableGrass[0].cut = 'fff'; })), [`invalid-value ${grassRoom}#/cuttableGrass/0`]);
    console.log('  ✓ an edited object state and grass record build and round-trip; a cell that is no metatile is an error');

    const other = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS, undefined, { tile_families: { format: 'png' }, tiles: { format: 'json' } });
    assert.ok(other.has('tile_families/family_000.png') && other.has('tiles/tile_0000.json'));
    const p = implode(other, GAME, KINDS);
    assert.deepStrictEqual(p.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(p.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => { t.delete('tiles/tile_0000.png'); t.set('tiles/tile_0000.json', other.get('tiles/tile_0000.json')!); }), []);
    console.log('  ✓ families as PNG stripes and tiles as JSON rows: the same ROM; one tile as JSON among PNGs too');

    // Strings: an unknown tag is an error; an edited string is encoded anew (our encoder) and explodes back.
    assert.deepStrictEqual(rules(t => { t.set('strings/string_0000.txt', new TextEncoder().encode('Hello [WAVE]\n')); }), ['invalid-value strings/string_0000.txt#']);
    const said = new Map(tree);
    said.set('strings/string_0375.txt', new TextEncoder().encode('[SLOW]Whoa![PAUSE:3d] Now I know how a moved string feels.[B]\n'));
    const sr = implode(said, GAME, KINDS);
    assert.deepStrictEqual(sr.findings.list.filter(f => f.severity === 'error'), []);
    assert.ok(sr.findings.list.some(f => f.rule === 'reencoded' && f.file === 'strings/string_0375.txt'));
    console.log('  ✓ strings: an unknown tag is an error; an edited string is encoded anew and round-trips');

    // Scripts: one file per script, a command per line (the opcode by name, its operands in hex), `@name` for another
    // script; a room's scripts in its folder. An edited script round-trips (an opcode as hex too); a name that is no
    // script, an opcode that is none, a relative call to a script after it, and operands that are no bytes are errors.
    const enter = 'maps/podunk_opening_over_the_machine/scripts/podunk_opening_over_the_machine_enter.txt';
    assert.ok(tree.has(enter) && tree.has('scripts/boot.txt') && tree.has('scripts/_scripts.json') && !tree.has('maps/_enter_scripts.json'));
    const opening = JSON.parse(Buffer.from(tree.get('maps/podunk_opening_over_the_machine/map.json')!).toString());
    assert.deepStrictEqual(opening.enter, { script: 'podunk_opening_over_the_machine_enter', word: '$0001' });
    const isScript = (p: string) => /^(scripts|maps\/[^/]+\/scripts)\/[^_/][^/]*\.txt$/.test(p);
    const scriptCount = [...tree.keys()].filter(isScript).length, inRooms = [...tree.keys()].filter(p => isScript(p) && p.startsWith('maps/')).length;
    assert.ok(scriptCount > 3000 && inRooms > 2000, `${scriptCount} script files, ${inRooms} in rooms`);
    const named = [...tree.keys()].filter(p => p.endsWith('/map.json')).some(p => JSON.parse(Buffer.from(tree.get(p)!).toString()).stepOn.some((t: { script: unknown }) => typeof t.script === 'string'));
    assert.ok(named, 'triggers name their scripts');
    const lines = (p: string) => Buffer.from(tree.get(p)!).toString().split('\n');
    const caller = [...tree.keys()].find(p => isScript(p) && lines(p).some(l => /^call @/.test(l)))!;
    const relative = [...tree.keys()].find(p => isScript(p) && lines(p).some(l => /^call_back @/.test(l)))!;
    const setLines = (t: typeof tree, p: string, edit: (l: string[]) => string[]) => t.set(p, new TextEncoder().encode(edit(lines(p)).join('\n')));
    // (the script it no longer names is left out: a warning)
    assert.deepStrictEqual(rules(t => setLines(t, caller, l => l.map(x => x.replace(/^call @\S+/, 'call @no_such_script')))).filter(r => !r.startsWith('left-out')), [`unknown-reference ${caller}#/${lines(caller).findIndex(l => /^call @/.test(l)) + 1}`]);
    assert.deepStrictEqual(rules(t => setLines(t, enter, l => ['no_such_opcode', ...l])), [`unknown-reference ${enter}#/1`]);
    assert.deepStrictEqual(rules(t => setLines(t, enter, l => ['end zz', ...l])), [`invalid-value ${enter}#/1`]);
    const r1 = rules(t => setLines(t, relative, l => l.map(x => x.replace(/^call_back @\S+/, 'call_back @boot')))).filter(r => !r.startsWith('left-out'));
    assert.ok(r1.length === 1 && r1[0].startsWith(`out-of-range ${relative}#`), r1.join());
    const sc = implode((() => { const t = new Map(tree); setLines(t, enter, l => ['a3 36', 'call_global 36', ...l]); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(sc.findings.list.filter(f => f.severity === 'error'), []);
    console.log(`  ✓ scripts: ${scriptCount} files (${inRooms} in room folders, enter and triggers named in map.json); an edited script builds and round-trips; an unknown @name or opcode, a relative call out of reach and operands that are no bytes are errors`);

    // Every table grows past vanilla and moves (the engine limits: 256 maps, 21,845 tiles and strings, 21,625 scripts).
    const grow = (dir: string, from: string, to: string, ext: string) => (t: typeof tree) => {
        t.set(`${dir}/${to}.${ext}`, t.get(`${dir}/${from}.${ext}`)!);
        editJson(t, `${dir}/_enum.json`, e => { e.names.push(to); });
    };
    const grown = new Map(tree);
    grow('tiles', 'tile_0000', 'tile_new', 'png')(grown);
    grow('strings', 'string_0000', 'string_new', 'txt')(grown);
    grow('scripts', 'boot', 'script_new', 'txt')(grown);
    const g = implode(grown, GAME, KINDS);
    assert.deepStrictEqual(g.findings.list.filter(f => f.severity !== 'info' && f.rule !== 'unreferenced').map(f => `${f.rule} ${f.file}`), []);
    for (const key of ['tiles/_table', 'strings/_table', 'scripts/_table']) assert.ok(g.placed.some(p => p.key === key && p.at !== p.home), `${key} did not move`);
    for (const [kind, limit] of [['maps', 256], ['tiles', 21845], ['strings', 21845], ['scripts', 21625], ['animate_ids', 2048], ['enemies', 256], ['characters', 254], ['sprite_blocks_16', 21845], ['sprite_blocks_8', 21845], ['opcodes', 195]] as const) assert.strictEqual(JSON.parse(Buffer.from(tree.get(`${kind}/_enum.json`)!).toString()).limit, limit, kind);
    console.log('  ✓ a new tile, string and table script: each table grows and moves, the round trip holds; limits at the engine\'s');

    // The table kinds of the table hack: a new animate id, enemy (with its own character) and sprite blocks grow
    // their tables, which move; the records stay one block at $xx:B678; an alias keeps its run together.
    const more = new Map(tree);
    grow('animate_ids', 'animate_000', 'animate_new', 'json')(more);
    grow('characters', 'fire_eyes', 'fire_eyes_copy', 'json')(more);
    grow('enemies', 'fire_eyes', 'fire_eyes_copy', 'json')(more);
    more.set('enemies/fire_eyes_copy.json', new TextEncoder().encode('{ "character": "fire_eyes_copy" }'));
    grow('sprite_blocks_16', 'block_0000', 'block_new', 'png')(more);
    grow('sprite_blocks_8', 'block_0000', 'block_new', 'png')(more);
    assert.ok(more.has('sprite_blocks_8/block_17c5.json'), 'the 8×8 alias (block 6085 reads blocks 0 and 407)');
    const m = implode(more, GAME, KINDS, { seed: 5 });
    assert.deepStrictEqual(m.findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}`), []);
    for (const key of ['animate_ids/_table', 'enemies/_table', 'sprite_blocks_16/_table', 'sprite_blocks_8/_table']) assert.ok(m.placed.some(p => p.key === key && p.at !== p.home), `${key} did not move`);
    assert.ok(m.placed.every(p => p.key !== 'characters/_records' || (p.at & 0xFFFF) === 0xB678), 'the records keep $B678');
    assert.deepStrictEqual(rules(t => editJson(t, 'enemies/fire_eyes.json', e => { e.character = 'nobody'; })), ['unknown-reference enemies/fire_eyes.json#/character']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/fire_eyes.json', c => { c.hp = 70000; })), ['invalid-value characters/fire_eyes.json#/hp']);
    console.log('  ✓ animate ids, enemies, characters, sprite blocks: new ones grow and move their tables (random), records stay at $B678; a bad character or field is an error');

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
