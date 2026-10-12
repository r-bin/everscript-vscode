#!/usr/bin/env node
'use strict';

// Recomp build: CDL library + asset knowledge + curated names -> Asar project (byte-identical,
// named, commented) + Mesen2 labels/CDL -> snesrecomp C -> REPORT.md with what still blocks.
// Usage and options: tools/recomp/README.md (or --help).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const { CdlLibrary, stripCopierHeader } = require(path.join(REPO, 'src/emulator/cdl/library'));
const { createRomMap } = require(path.join(REPO, 'src/emulator/cdl/rom-map'));
const { exportAsar } = require(path.join(REPO, 'src/emulator/cdl/asar-export'));
const { romRegions } = require(path.join(REPO, 'src/rom'));
const { collectNames } = require('./names');
const { writeReport } = require('./report');

const HELP = `node tools/recomp/build.js [options]      (npm run recomp -- [options])
  --rom <file>         clean ROM (env SOE_ROM)
  --lib <dir>          CDL library root (default: VS Code globalStorage rbin.everscript/cdl-library)
  --out <dir>          output folder (default: out/recomp)
  --asar <bin>         Asar binary (env ASAR; default: asar on PATH, else ../asar/asar/bin/asar)
  --snesrecomp <dir>   snesrecomp checkout (env SNESRECOMP; default: ../snesrecomp)
  --no-recomp          stop after the Asar rebuild
  --compile            also build snesrecomp's static library (CMake + Ninja)
  --strict             exit 1 unless the rebuild is byte-identical and snesrecomp succeeded`;

function args(argv) {
    const o = { recomp: true, compile: false, strict: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i], next = () => argv[++i];
        if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
        else if (a === '--rom') o.rom = next();
        else if (a === '--lib') o.lib = next();
        else if (a === '--out') o.out = next();
        else if (a === '--asar') o.asar = next();
        else if (a === '--snesrecomp') o.snesrecomp = next();
        else if (a === '--no-recomp') o.recomp = false;
        else if (a === '--compile') o.compile = true;
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
    const romPath = o.rom || process.env.SOE_ROM;
    if (!romPath || !fs.existsSync(romPath)) { console.error('No ROM: pass --rom <clean ROM> or set SOE_ROM.'); process.exit(2); }
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

    const inputs = step('inputs: CDL library, names, assets', () => {
        const lib = new CdlLibrary(libRoot, romFile, {});
        const recorded = fs.existsSync(path.join(lib.dir, 'rom.cdl'));
        const n = collectNames(map, rom.length);
        const assets = romRegions(romFile).filter(r => r.e > r.s).map(r => ({ start: r.s, end: r.e, name: r.name }));
        return { lib, recorded, libDir: lib.dir, names: n, assets };
    });

    const exp = step('export: Asar project + Mesen2 files + snesrecomp seeds', () => {
        const r = exportAsar(inputs.lib, romFile, asarDir, { names: inputs.names.names, wramNames: inputs.names.wramNames, assets: inputs.assets });
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
        const sr = path.resolve(o.snesrecomp || process.env.SNESRECOMP || path.join(REPO, '../snesrecomp'));
        recomp = step('recomp: snesrecomp generate', () => runSnesrecomp({ sr, asarDir, out, compile: o.compile, rom: rebuild.identical ? path.join(asarDir, 'build/out.sfc') : path.join(asarDir, 'rom.bin') }));
    }

    const report = writeReport({ out, romPath, sha1, map, rom, inputs, exp, rebuild, recomp, log });
    console.log('\n' + report.summary + '\nReport: ' + path.relative(process.cwd(), report.file));
    if (o.strict && !(rebuild.identical && (recomp.skipped || recomp.ok))) process.exit(1);
}

function runSnesrecomp({ sr, asarDir, out, compile, rom }) {
    const cli = path.join(sr, 'snesrecomp_cli.py');
    if (!fs.existsSync(cli)) return { ok: false, reason: 'snesrecomp not found at ' + sr + ' (--snesrecomp or SNESRECOMP)' };
    const py = process.env.PYTHON || 'python3';
    const env = { ...process.env, PATH: path.join(os.homedir(), '.cargo/bin') + ':' + process.env.PATH };
    const proj = path.join(asarDir, 'recomp', 'project');
    let text = '';
    if (!fs.existsSync(path.join(proj, 'CMakeLists.txt'))) {
        fs.rmSync(proj, { recursive: true, force: true });
        const s = run(py, [cli, 'build', '--rom', rom, '--output', proj], { env });
        text += '$ snesrecomp build\n' + s.out + '\n';
        if (s.status !== 0) { fs.writeFileSync(path.join(out, 'snesrecomp.log'), text); return { ok: false, reason: 'scaffold failed (snesrecomp.log)', status: s.status }; }
    }
    const cfgDir = path.join(proj, 'config');
    for (const f of fs.readdirSync(cfgDir)) if (/^bank.*\.cfg$/.test(f)) fs.rmSync(path.join(cfgDir, f));
    const seeds = path.join(asarDir, 'recomp', 'cfg');
    for (const f of fs.readdirSync(seeds)) fs.copyFileSync(path.join(seeds, f), path.join(cfgDir, f));
    const g = run(py, [cli, 'generate', '--rom', rom, '--project-root', proj, '--cfg-dir', 'config', '--out-dir', 'generated', '--cfg-roots', '--no-host-root-scan'], { env });
    text += '$ snesrecomp generate\n' + g.out + '\n';
    let compiled = null;
    if (g.status === 0 && compile) {
        const c = run('sh', [path.join(proj, 'build.sh')], { env });
        text += '$ build.sh\n' + c.out + '\n';
        compiled = c.status === 0;
    }
    fs.writeFileSync(path.join(out, 'snesrecomp.log'), text);
    return { ok: g.status === 0 && compiled !== false, status: g.status, compiled, output: g.out, project: proj };
}

main();
