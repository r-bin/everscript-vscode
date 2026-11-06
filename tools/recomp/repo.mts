// The recomp project: its own repository (SecretOfEvermoreRecomp: snesrecomp scaffold, our glue,
// docs). This repo only feeds it: the CDL seeds go into its recomp/, the exclusions it decided come
// back from its recomp/seed-exclusions.txt, and it builds with its own tools/regen.sh and CMake.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO = resolve(import.meta.dirname, '..', '..');
export const SEED_MARK = '# >>> everscript data regions (written by npm run recomp)';
export const SEED_END = '# <<< everscript data regions';
export const EXCLUSIONS = 'recomp/seed-exclusions.txt';

/** The recomp repository: `--repo`, else SOE_RECOMP, else the sibling checkout. */
export function recompRepo(arg?: string): string {
    return resolve(arg || process.env.SOE_RECOMP || join(REPO, '..', 'SecretOfEvermoreRecomp'));
}

/** The built game in the recomp repository. */
export function gameExe(repo = recompRepo()): string {
    const primary = join(repo, 'build', 'SecretOfEvermoreSNESRecomp' + (process.platform === 'win32' ? '.exe' : ''));
    if (existsSync(primary)) return primary;
    const local = join(REPO, 'out', 'recomp', 'project', 'build', 'SecretOfEvermoreSNESRecomp' + (process.platform === 'win32' ? '.exe' : ''));
    return existsSync(local) ? local : primary;
}

/** The exclusions file's text, or '' when the repository has none. */
export function readExclusions(repo: string): string {
    const f = join(repo, EXCLUSIONS);
    return existsSync(f) ? readFileSync(f, 'utf8') : '';
}

/** Our seeds: bank8x..Fx cfgs replace the previous ones; bank00 keeps its own text and gains one data-region block. */
/**
 * Entry PCs of the last generation (src/gen/program_manifest.json, `nodes` keyed "0C98C7:M0X0"): the entries
 * snesrecomp found itself, which the seeds then name with `symbol` lines. Empty before the first generation;
 * `symbol` adds no roots, so the set is the same on the next run.
 */
export function readNodes(repo: string): number[] {
    const f = join(repo, 'src', 'gen', 'program_manifest.json');
    if (!existsSync(f)) return [];
    const keys = Object.keys(JSON.parse(readFileSync(f, 'utf8')).nodes || {});
    return [...new Set(keys.map(k => parseInt(k.slice(0, 6), 16)))];
}

export function writeSeeds(seedDir: string, repo: string): { banks: number; regions: number } {
    const cfgDir = join(repo, 'recomp');
    for (const f of readdirSync(cfgDir)) if (/^bank[89a-f][0-9a-f]\.cfg$/i.test(f)) rmSync(join(cfgDir, f));
    let banks = 0;
    for (const f of readdirSync(seedDir)) {
        if (!/^bank[0-9a-f]{2}\.cfg$/i.test(f) || f === 'bank00.cfg') continue;
        copyFileSync(join(seedDir, f), join(cfgDir, f));
        banks++;
    }
    const b00 = join(cfgDir, 'bank00.cfg');
    let text = readFileSync(b00, 'utf8');
    const i = text.indexOf(SEED_MARK);
    if (i >= 0) text = text.slice(0, i).replace(/\n+$/, '\n');
    const regions = readFileSync(join(seedDir, 'bank00.cfg'), 'utf8').split('\n').filter(l => l.startsWith('data_region'));
    writeFileSync(b00, text + '\n' + SEED_MARK + '\n' + regions.join('\n') + '\n' + SEED_END + '\n');
    return { banks, regions: regions.length };
}

/** The C the recomp binds, so it builds alone: the files in its CMake list SOE_BOUND_C and all headers, into src/bound-c/. */
export function writeBoundC(repo: string): { files: number } {
    const list = /set\(SOE_BOUND_C\s+([^)]+)\)/.exec(readFileSync(join(repo, 'CMakeLists.txt'), 'utf8'));
    if (!list) throw new Error('no SOE_BOUND_C in the recomp repository\'s CMakeLists.txt');
    const source = join(REPO, 'reconstructed-c'), target = join(repo, 'src', 'bound-c');
    rmSync(target, { recursive: true, force: true });
    const files = [...list[1].trim().split(/\s+/), ...readdirSync(join(source, 'include')).map(f => join('include', f))];
    for (const f of files) {
        mkdirSync(dirname(join(target, f)), { recursive: true });
        copyFileSync(join(source, f), join(target, f));
    }
    writeFileSync(join(target, 'README.md'), 'Exported from everscript-vscode\'s `reconstructed-c/` by its `npm run recomp`. Do not edit here: change the source and export again.\n');
    return { files: files.length };
}

/** Regenerate the C (tools/regen.sh) and build with CMake; everything goes to `log`. */
export function buildRepo(repo: string, romPath: string, log: string): { ok: boolean; reason?: string; output: string; exe?: string } {
    writeFileSync(log, '');
    const env = { ...process.env, PATH: join(homedir(), '.cargo/bin') + ':' + process.env.PATH };
    let output = '';
    const run = (cmd: string, argv: string[]) => {
        const r = spawnSync(cmd, argv, { cwd: repo, env, encoding: 'utf8', maxBuffer: 512 << 20 });
        const out = (r.stdout || '') + (r.stderr || '');
        writeFileSync(log, `$ ${cmd} ${argv.join(' ')}\n${out}\n`, { flag: 'a' });
        output += out;
        return r.status === 0;
    };
    if (!run('bash', ['tools/regen.sh', '--rom', resolve(romPath)])) return { ok: false, reason: 'regen failed (recomp-host.log)', output };
    if (!existsSync(join(repo, 'build', 'CMakeCache.txt')) && !run('cmake', ['-S', '.', '-B', 'build', '-DCMAKE_BUILD_TYPE=Release'])) return { ok: false, reason: 'cmake configure failed (recomp-host.log)', output };
    if (!run('cmake', ['--build', 'build', '-j', '--config', 'Release'])) return { ok: false, reason: 'build failed (recomp-host.log)', output };
    return { ok: true, output, exe: gameExe(repo) };
}
