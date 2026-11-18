// Open Evermore on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library, then
// implode the tree in memory: stable gives the vanilla sha1 with no warning (G0); two random layouts place every
// room and the tile family array, rewrite their tables and explode back to the same tree; cross-kind references
// and colours are checked. Playing them is `open-evermore.mts prove` (on
// demand, minutes: never in a tier). Skips without the ROM.
// Run: node tests/open-evermore/g0.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GAME, KINDS } from '../../tools/open-evermore/evermore/kinds.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { sha1 } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { stripCopierHeader } = require('../../dist/platform/roms/header');

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
        console.log(`  ✓ random ${seed}: ${moved} of ${r.placed.length} resources moved (tile families ${families.at === families.home ? 'stayed' : 'moved'}), tables rewritten, round trip holds`);
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
    console.log('  ✓ a map naming a missing family, and a colour the SNES cannot show, are errors');
}
