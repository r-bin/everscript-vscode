// Emulator-tier headless MesenCE verification for all ready Open Evermore demos + baseline negative checks.
// Skips gracefully if the Evermore base ROM or MesenCE binary is absent.
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { listDemos, loadRuntime, verifyDemo } from '../../tools/open-evermore/demos.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { findMesen } from '../../tools/open-evermore/mesen.mts';
import { sha1 } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { identifyRom } = require('../../dist/platform');
const { stripCopierHeader } = require('../../dist/platform/roms/header');

const OUT = join(import.meta.dirname, '../../out/open-evermore-demos');
const romPath = games.baseRomPath('evermore');
const mesen = findMesen();

if (!romPath || !existsSync(romPath)) {
    console.log('\nOpen Evermore demos (MesenCE): skipped (no Evermore base ROM in library)');
} else if (!mesen) {
    console.log('\nOpen Evermore demos (MesenCE): skipped (MesenCE binary not found; set MESEN)');
} else {
    console.log(`\nOpen Evermore demos (MesenCE: ${mesen}):`);
    const baseRom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(romPath)));
    const release: string = identifyRom(baseRom).variant ?? 'us';
    const { GAME, KINDS, PAST_END } = await loadRuntime(release);
    const baseTree = explode(baseRom, { release, sha1: sha1(baseRom), explodedWith: 'demos-mesen-test' }, GAME, KINDS);
    const demos = listDemos();

    for (const demo of demos) {
        const report = await verifyDemo({
            demo,
            baseRom,
            baseTree,
            game: GAME,
            kinds: KINDS,
            pastEnd: PAST_END,
            randomSeed: 11,
            checkAsar: true,
            mesenBin: mesen,
            checkBaseline: true,
            outDir: OUT,
        });
        assert.ok(report.ok, `${demo.name} failed: ${report.errors.join('; ')}`);
        assert.strictEqual(report.baselineFailed, true, `${demo.name} baseline check must fail on unmodified ROM`);
        console.log(`  ✓ ${demo.name}: ${report.mesenChecks.map((c) => `${c.name}=PASS`).join(', ')}${report.asarVerified ? ' + asar' : ''} + baseline_fail`);
    }
    console.log(`  screenshots: ${OUT}`);
}
