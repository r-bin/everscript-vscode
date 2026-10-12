'use strict';

// The runnable recomp: scaffold a snesrecomp host project (out/recomp/project, generated, never
// committed), lay our glue from tools/recomp/host/ over it, add the CDL seeds, regenerate, build,
// and copy the game into out/recomp/SecretOfEvermore-<os>-<arch>/ with a start script.
// Framework: snesrecomp (PolyForm Noncommercial 1.0.0) — its scaffold files are generated here,
// only our own glue lives in git.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GLUE = path.join(__dirname, 'host');
const SEED_MARK = '# >>> everscript data regions (written by npm run recomp)';
const SEED_END = '# <<< everscript data regions';

function run(cmd, argv, opts, logFile) {
    const t0 = Date.now();
    const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 512 << 20, ...opts });
    const out = (r.stdout || '') + (r.stderr || '');
    if (logFile) fs.appendFileSync(logFile, `\n$ ${cmd} ${argv.join(' ')}\n${out}`);
    return { status: r.status, out, ms: Date.now() - t0, error: r.error ? r.error.message : null };
}

function platformTag() {
    const os = { darwin: 'macos', win32: 'windows', linux: 'linux' }[process.platform] || process.platform;
    return os + '-' + process.arch;
}

function copyTree(from, to) {
    let n = 0;
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        if (e.name === 'README.md' && from === GLUE) continue;
        const a = path.join(from, e.name), b = path.join(to, e.name);
        if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); n += copyTree(a, b); }
        else { fs.copyFileSync(a, b); n++; }
    }
    return n;
}

/** Scaffold once (or again with fresh): local git repo, framework submodules, no GitHub/CI/netplay. */
function ensureProject({ snesrecomp, romPath, out, project, fresh, log }) {
    if (fresh) fs.rmSync(project, { recursive: true, force: true });
    if (fs.existsSync(path.join(project, 'CMakeLists.txt'))) return { ok: true, scaffolded: false };
    const setup = path.join(snesrecomp, 'tools/new_project/setup_project.sh');
    if (!fs.existsSync(setup)) return { ok: false, reason: 'snesrecomp scaffold not found at ' + setup };
    const tmp = path.join(out, '.scaffold');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const r = run('sh', [setup, '--rom', romPath, '--dir', tmp, '--name', 'Secret of Evermore', '--players', '1',
        '--no-netplay', '--no-ci', '--no-fetch-boxart', '--no-github', '--no-generate', '--no-build', '--yes'], { cwd: snesrecomp }, log);
    const made = fs.existsSync(tmp) ? fs.readdirSync(tmp).filter(d => fs.existsSync(path.join(tmp, d, 'CMakeLists.txt'))) : [];
    if (r.status !== 0 || made.length !== 1) return { ok: false, reason: 'scaffold failed (recomp-host.log)' };
    fs.rmSync(project, { recursive: true, force: true });
    fs.renameSync(path.join(tmp, made[0]), project);
    fs.rmSync(tmp, { recursive: true, force: true });
    return { ok: true, scaffolded: true };
}

/**
 * Hook our glue into the scaffold's main.c (generated, not stored in git): one descriptor field
 * plus its declaration. Idempotent; fails loudly when the scaffold's layout changes.
 */
function hookMain(project) {
    const file = path.join(project, 'src', 'main.c');
    let s = fs.readFileSync(file, 'utf8');
    if (s.includes('SoeAfterConfig')) return { ok: true, patched: false };
    const decl = '#include "game_rtl.h"\n';
    const field = /(static const SnesDesktopHostGame kGameHost = \{\n)/;
    if (!s.includes(decl) || !field.test(s)) return { ok: false, reason: 'src/main.c layout changed: cannot hook SoeAfterConfig' };
    s = s.replace(decl, decl + 'void SoeAfterConfig(void);   /* everscript glue: tools/recomp/host/src/game_rtl.c */\n');
    s = s.replace(field, '$1    .after_config        = SoeAfterConfig,   /* everscript glue */\n');
    fs.writeFileSync(file, s);
    return { ok: true, patched: true };
}

/**
 * Give our glue the beam driver's resume point (framework file, generated, not stored in git):
 * its file save states carry neither that PC nor g_cpu, so game_rtl.c saves and restores both
 * (docs/recomp/bugs-and-todos.md, save states). Three accessors after its statics. Idempotent.
 */
function hookBeamDriver(project) {
    const file = path.join(project, 'snesrecomp', 'runner', 'src', 'beam_frame_driver.c');
    let s = fs.readFileSync(file, 'utf8');
    if (s.includes('snes_beam_frame_driver_set_resume')) return { ok: true, patched: false };
    const anchor = 'static bool s_wai_halted;\n';
    if (!s.includes(anchor)) return { ok: false, reason: 'beam_frame_driver.c layout changed: cannot hook the resume point' };
    s = s.replace(anchor, anchor +
        '\n/* everscript glue (tools/recomp/host.js): save states restore the resume point. */\n' +
        'uint32_t snes_beam_frame_driver_resume_pc(void) { return s_resume_pc; }\n' +
        'bool snes_beam_frame_driver_wai_halted(void) { return s_wai_halted; }\n' +
        'void snes_beam_frame_driver_set_resume(uint32_t pc, bool wai_halted) { s_resume_pc = pc; s_wai_halted = wai_halted; }\n');
    fs.writeFileSync(file, s);
    return { ok: true, patched: true };
}

/** Our seeds: bank8x/9x cfgs replace the previous ones; bank00 keeps its generated block and gains our data regions. */
function applySeeds(seedDir, project) {
    const cfgDir = path.join(project, 'recomp');
    for (const f of fs.readdirSync(cfgDir)) if (/^bank[89a-f][0-9a-f]\.cfg$/i.test(f)) fs.rmSync(path.join(cfgDir, f));
    let banks = 0;
    for (const f of fs.readdirSync(seedDir)) {
        if (!/^bank[0-9a-f]{2}\.cfg$/i.test(f) || f === 'bank00.cfg') continue;
        fs.copyFileSync(path.join(seedDir, f), path.join(cfgDir, f));
        banks++;
    }
    const b00 = path.join(cfgDir, 'bank00.cfg');
    let text = fs.readFileSync(b00, 'utf8');
    const i = text.indexOf(SEED_MARK);
    if (i >= 0) text = text.slice(0, i).replace(/\n+$/, '\n');
    const regions = fs.readFileSync(path.join(seedDir, 'bank00.cfg'), 'utf8').split('\n').filter(l => l.startsWith('data_region'));
    fs.writeFileSync(b00, text + '\n' + SEED_MARK + '\n' + regions.join('\n') + '\n' + SEED_END + '\n');
    return { banks, regions: regions.length };
}

/** Copy the built game and write a start script; the folder runs on its own. */
function packageGame({ project, out, romPath }) {
    const tag = platformTag();
    const exeName = 'SecretOfEvermoreSNESRecomp' + (process.platform === 'win32' ? '.exe' : '');
    const built = [path.join(project, 'build', exeName), path.join(project, 'build', 'Release', exeName)].find(p => fs.existsSync(p));
    if (!built) return { ok: false, reason: 'executable not found in project/build' };
    const dir = path.join(out, 'SecretOfEvermore-' + tag);
    // Replace only what this step writes: saves/ (SRAM + save states), config.ini and keybinds.ini
    // belong to the player and survive every rebuild.
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['SecretOfEvermore', 'SecretOfEvermore.exe', 'assets', 'mods', 'play.command', 'play.sh', 'play.bat']) {
        fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    }
    const exe = path.join(dir, 'SecretOfEvermore' + (process.platform === 'win32' ? '.exe' : ''));
    fs.copyFileSync(built, exe);
    fs.chmodSync(exe, 0o755);
    for (const sub of ['assets', 'mods']) {
        const src = path.join(path.dirname(built), sub);
        if (fs.existsSync(src)) { fs.mkdirSync(path.join(dir, sub), { recursive: true }); copyTree(src, path.join(dir, sub)); }
    }
    const rom = path.resolve(romPath);
    let script;
    if (process.platform === 'win32') {
        script = path.join(dir, 'play.bat');
        fs.writeFileSync(script, `@echo off\r\ncd /d "%~dp0"\r\nSecretOfEvermore.exe "${rom}" %*\r\n`);
    } else {
        script = path.join(dir, process.platform === 'darwin' ? 'play.command' : 'play.sh');
        fs.writeFileSync(script, `#!/bin/sh\n# Start the Secret of Evermore recomp with the ROM it was built from.\ncd "$(dirname "$0")"\nexec ./SecretOfEvermore "${rom}" "$@"\n`, { mode: 0o755 });
    }
    return { ok: true, dir, exe, script, tag };
}

/**
 * Whole host step. Returns { ok, reason?, parsedOutput, dir, exe, script, scaffolded, glue, seeds }.
 */
function buildHost({ snesrecomp, romPath, out, seedDir, fresh, build }) {
    const project = path.join(out, 'project');
    const log = path.join(out, 'recomp-host.log');
    fs.writeFileSync(log, '');
    const p = ensureProject({ snesrecomp, romPath, out, project, fresh, log });
    if (!p.ok) return { ok: false, reason: p.reason };
    const glue = copyTree(GLUE, project);
    const hook = hookMain(project);
    if (!hook.ok) return { ok: false, reason: hook.reason };
    const beam = hookBeamDriver(project);
    if (!beam.ok) return { ok: false, reason: beam.reason };
    const seeds = applySeeds(seedDir, project);
    const env = { ...process.env, SNESRECOMP_ROM: path.resolve(romPath), PATH: path.join(require('os').homedir(), '.cargo/bin') + ':' + process.env.PATH };
    const g = run('bash', ['tools/regen.sh', '--cfg-roots', '--rom', path.resolve(romPath)], { cwd: project, env }, log);
    const res = { scaffolded: p.scaffolded, glue, seeds, project, output: g.out };
    if (g.status !== 0) return { ...res, ok: false, reason: 'regen failed (recomp-host.log)' };
    if (!build) return { ...res, ok: true, built: false };
    if (!fs.existsSync(path.join(project, 'build', 'CMakeCache.txt'))) {
        const c = run('cmake', ['-S', '.', '-B', 'build', '-DCMAKE_BUILD_TYPE=Release'], { cwd: project, env }, log);
        if (c.status !== 0) return { ...res, ok: false, reason: 'cmake configure failed (recomp-host.log)' };
    }
    const b = run('cmake', ['--build', 'build', '-j', '--config', 'Release'], { cwd: project, env }, log);
    if (b.status !== 0) return { ...res, ok: false, built: false, reason: 'build failed (recomp-host.log)' };
    const pkg = packageGame({ project, out, romPath });
    return { ...res, ...pkg, built: true, ok: pkg.ok };
}

module.exports = { buildHost, platformTag, applySeeds, hookMain, hookBeamDriver, packageGame };
