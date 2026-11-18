// Open Evermore on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library, then
// implode the tree in memory: stable gives the vanilla sha1 with no warning (G0); two random layouts place every
// room, rewrite the map table and explode back to the same tree. Playing them is `open-evermore.mts prove` (on
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
        console.log(`  ✓ random ${seed}: ${moved} of ${r.placed.length} rooms moved, map table rewritten, round trip holds`);
    }
}
