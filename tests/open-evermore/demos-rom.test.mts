// ROM-tier tests for Open Evermore demos: verifies every ready demo (and all 4 combined) implodes cleanly
// under strict/random layouts and rebuilds byte-identically through Asar when available. Skips without base ROM.
import assert from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assembleWithAsar, findAsar } from '../../tools/open-evermore/asar-project.mts';
import { applyDemo, applyDemos, listDemos, loadRuntime } from '../../tools/open-evermore/demos.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { sha1, writeTree } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { identifyRom } = require('../../dist/platform');
const { stripCopierHeader } = require('../../dist/platform/roms/header');

const romPath = games.baseRomPath('evermore');
if (!romPath || !existsSync(romPath)) {
    console.log('\nOpen Evermore demos (rom tier): skipped (no Evermore base ROM in library)');
} else {
    console.log('\nOpen Evermore demos (rom tier):');
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(romPath)));
    const release: string = identifyRom(rom).variant ?? 'us';
    const { GAME, KINDS, PAST_END } = await loadRuntime(release);
    const tree = explode(rom, { release, sha1: sha1(rom), explodedWith: 'demos-rom-test' }, GAME, KINDS);
    const demos = listDemos();
    assert.strictEqual(demos.length, 5);

    for (const demo of demos) {
        for (const noScene of [false, true]) {
            const applied = applyDemo(tree, demo, { noScene });
            const built = implode(applied, GAME, KINDS, { seed: 7, pastEnd: PAST_END });
            const errs = built.findings.list.filter((f) => f.severity === 'error');
            assert.deepStrictEqual(errs, [], `${demo.name} (noScene=${noScene}) errors: ${JSON.stringify(errs)}`);
            assert.ok(built.image && built.image.length >= 0x300000);
        }
        console.log(`  ✓ ${demo.name} implodes cleanly (scene & --no-scene, --random 7)`);
    }

    // Combined stack of all 4 ready mods (--no-scene so scenes don't overwrite the same opening enter script).
    const combined = applyDemos(tree, demos, { noScene: true });
    const stackBuild = implode(combined, GAME, KINDS, { seed: 7, pastEnd: PAST_END, emitAsar: true });
    const stackErrors = stackBuild.findings.list.filter((f) => f.severity === 'error');
    assert.deepStrictEqual(stackErrors, [], `combined demo stack errors: ${JSON.stringify(stackErrors)}`);
    console.log(`  ✓ combined stack (${demos.map((d) => d.name).join(' + ')}) implodes cleanly under --random 7`);

    const asarBin = findAsar();
    if (asarBin && stackBuild.asar) {
        const tmp = mkdtempSync(join(tmpdir(), 'oe-demos-asar-'));
        try {
            writeTree(tmp, new Map([...combined].filter(([p]) => p.startsWith('code/'))));
            const asarDir = join(tmp, '_build', 'asar');
            writeTree(asarDir, stackBuild.asar);
            const res = assembleWithAsar(asarDir, join(tmp, '_build', 'out.sfc'), asarBin);
            assert.ok(res.ok, `asar failed on combined stack: ${res.error}`);
            const expected = stackBuild.layout?.startsWith('HiROM') ? stackBuild.image! : stackBuild.content!;
            assert.strictEqual(sha1(res.image!), sha1(expected), 'combined stack Asar SHA-1 mismatch');
            console.log('  ✓ combined stack rebuilds byte-identically through Asar');
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    }
}
