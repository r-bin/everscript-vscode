#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

// Recomp build: CDL library + asset knowledge + curated names -> Asar project (byte-identical,
// named, commented) + Mesen2 labels/CDL + snesrecomp seeds, written into the recomp repository
// (SecretOfEvermoreRecomp), which then regenerates and builds -> REPORT.md with what still blocks.
// Usage and options: tools/recomp/README.md (or --help).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
// The compiled modules (npm run recomp builds dist/ first).
const { CdlLibrary, stripCopierHeader } = require(path.join(REPO, 'dist/platform/cdl/library'));
const { createRomMap } = require(path.join(REPO, 'dist/platform/cdl/rom-map'));
const { exportAsar } = require(path.join(REPO, 'dist/platform/cdl/asar-export'));
const { romRegions } = require(path.join(REPO, 'dist/games/evermore/rom'));
const { parseExclusions } = require(path.join(REPO, 'dist/platform/cdl/recomp-analysis'));
const { collectNames } = require('./names');
const { writeReport } = require('./report');
const { recompRepo, readExclusions, writeSeeds, buildRepo, EXCLUSIONS } = require('./repo.mts');

const HELP = `node tools/recomp/build.js [options]      (npm run recomp -- [options])
  --rom <file>         clean ROM (default: the base ROM of the ROM library)
  --lib <dir>          CDL library root (default: VS Code globalStorage rbin.everscript/cdl-library)
  --out <dir>          output folder for the Asar project and the report (default: out/recomp)
  --asar <bin>         Asar binary (env ASAR; default: asar on PATH, else ../asar/asar/bin/asar)
  --repo <dir>         the recomp repository (env SOE_RECOMP; default: ../SecretOfEvermoreRecomp)
  --no-recomp          stop after the Asar rebuild (the recomp repository is not touched)
  --no-build           write the seeds into the recomp repository, do not regenerate or build
  --strict             exit 1 unless the rebuild is byte-identical and the game was built`;

function args(argv) {
    const o = { recomp: true, build: true, strict: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i], next = () => argv[++i];
        if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
        else if (a === '--rom') o.rom = next();
        else if (a === '--lib') o.lib = next();
        else if (a === '--out') o.out = next();
        else if (a === '--asar') o.asar = next();
        else if (a === '--repo') o.repo = next();
        else if (a === '--no-recomp') o.recomp = false;
        else if (a === '--no-build') o.build = false;
        else if (a === '--strict') o.strict = true;
        else { console.error('unknown option ' + a + '\n' + HELP); process.exit(2); }
    }
    return o;
}

function which(bin) {
    const r = spawnSync('sh', ['-c', 'command -v "$0"', bin], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

function run(cmd, argv, opts) {
    const t0 = Date.now();
    const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 << 20, ...opts });
    return { status: r.status, error: r.error ? r.error.message : null, out: (r.stdout || '') + (r.stderr || ''), ms: Date.now() - t0 };
}

function main() {
    const o = args(process.argv.slice(2));
    const romPath = require('../rom').baseRomOrExit('evermore', o.rom);
    const out = path.resolve(o.out || path.join(REPO, 'out', 'recomp'));
    const asarDir = path.join(out, 'asar');
    fs.mkdirSync(asarDir, { recursive: true });
    const log = [];
    const step = (name, fn) => {
        const t0 = Date.now();
        process.stdout.write('== ' + name + ' ... ');
        const r = fn();
        const ms = Date.now() - t0;
        console.log((r && r.ok === false ? 'FAILED' : 'ok') + ' (' + (ms / 1000).toFixed(1) + ' s)');
        log.push({ name, ms, ...(r || {}) });
        return r || {};
    };

    const romFile = fs.readFileSync(romPath);
    const rom = stripCopierHeader(romFile);
    const sha1 = crypto.createHash('sha1').update(romFile).digest('hex');
    const map = createRomMap(rom);
    const libRoot = o.lib || path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library');

    const repo = recompRepo(o.repo);
    const inputs = step('inputs: CDL library, names, assets', () => {
        const lib = new CdlLibrary(libRoot, romFile, {});
        const recorded = fs.existsSync(path.join(lib.dir, 'rom.cdl'));
        const n = collectNames(map, rom.length);
        const assets = romRegions(romFile).filter(r => r.e > r.s).map(r => ({ start: r.s, end: r.e, name: r.name }));
        const exclusions = parseExclusions(o.recomp ? readExclusions(repo) : '');
        return { lib, recorded, libDir: lib.dir, names: n, assets, exclusions };
    });

    const exp = step('export: Asar project + Mesen2 files + snesrecomp seeds', () => {
        const r = exportAsar(inputs.lib, romFile, asarDir, { names: inputs.names.names, wramNames: inputs.names.wramNames, assets: inputs.assets, recompExclusions: inputs.exclusions });
        return { result: r };
    }).result;

    const asar = o.asar || process.env.ASAR || which('asar') || [path.resolve(REPO, '../asar/asar/bin/asar')].find(p => fs.existsSync(p));
    const rebuild = step('rebuild: asar -> byte-identical check', () => {
        if (!asar) return { ok: false, reason: 'asar not found (--asar or ASAR)' };
        const r = run('sh', ['build.sh'], { cwd: asarDir, env: { ...process.env, ASAR: asar } });
        fs.writeFileSync(path.join(out, 'asar.log'), r.out);
        const built = path.join(asarDir, 'build', 'out.sfc');
        if (r.status !== 0 || !fs.existsSync(built)) return { ok: false, reason: 'asar failed (asar.log)', status: r.status };
        const b = fs.readFileSync(built);
        let diff = -1;
        for (let i = 0; i < Math.max(b.length, rom.length); i++) if (b[i] !== rom[i]) { diff = i; break; }
        return { ok: diff < 0, identical: diff < 0, firstDiff: diff, size: b.length };
    });

    let recomp = { skipped: true };
    if (o.recomp) {
        recomp = step('recomp: seeds into ' + path.relative(process.cwd(), repo) + (o.build ? ', regenerate, build' : ''), () => {
            if (!fs.existsSync(path.join(repo, 'tools', 'regen.sh'))) return { ok: false, reason: 'no recomp repository at ' + repo + ' (--repo or SOE_RECOMP)' };
            const seeds = writeSeeds(path.join(asarDir, 'recomp', 'cfg'), repo);
            const res = { repo, seeds, exclusions: EXCLUSIONS };
            if (!o.build) return { ...res, ok: true, built: false };
            return { ...res, ...buildRepo(repo, romPath, path.join(out, 'recomp-host.log')), built: true };
        });
        if (recomp.exe) console.log('   game: ' + path.relative(process.cwd(), recomp.exe));
    }

    const report = writeReport({ out, romPath, sha1, map, rom, inputs, exp, rebuild, recomp, log });
    console.log('\n' + report.summary + '\nReport: ' + path.relative(process.cwd(), report.file));
    if (o.strict && !(rebuild.identical && (recomp.skipped || (recomp.ok && (recomp.exe || !o.build))))) process.exit(1);
}

main();
