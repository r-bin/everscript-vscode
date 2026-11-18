// Open Evermore G0 on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library,
// implode the tree in memory: the vanilla sha1, no error, no warning, and the round trip holds. Skips without the ROM.
// Run: node tests/open-evermore/g0.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
    const tree = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' });
    const r = implode(tree);

    console.log('\nOpen Evermore G0:');
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(r.sha1, sha1(rom));
    console.log(`  ✓ base ROM → ${tree.size} files → the same ROM (${r.sha1}), no warnings`);
}
