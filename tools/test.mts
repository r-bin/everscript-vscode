// Runs test tiers (tests/tiers.json; docs/cleanup.md 6.6, AI_ARCHITECTURE_GUIDE.md §4).
//   node tools/test.mts unit             one tier; several: unit rom dom; all: every tier
// Each test file runs in its own node process, in order; the run fails if any file fails, and
// before running it fails if a tests/**/*.test.js is in no tier (or in two), so none is forgotten.
// A file still running after a minute is reported each minute; after TEST_TIMEOUT seconds (default
// 900) it is killed and counted as stuck. Node 26 can deadlock in process.exit() (a V8 compile
// worker waits on a GC the exiting thread never runs), so tests end with process.exitCode instead.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const tiers = JSON.parse(readFileSync(join(ROOT, 'tests/tiers.json'), 'utf8'));
const NAMES = ['unit', 'rom', 'dom', 'emulator'];

const seen = new Map<string, string>();
const problems: string[] = [];
for (const name of [...NAMES, 'manual']) {
    const files: string[] = name === 'manual' ? Object.keys(tiers.manual) : tiers[name];
    for (const f of files) {
        if (seen.has(f)) problems.push(`${f} is in ${seen.get(f)} and ${name}`);
        seen.set(f, name);
    }
}
const tracked = execFileSync('git', ['ls-files', 'tests'], { cwd: ROOT }).toString().split('\n').filter((f) => f.endsWith('.test.js'));
for (const f of tracked) if (!seen.has(f)) problems.push(`${f} is in no tier (tests/tiers.json)`);
for (const f of seen.keys()) if (!tracked.includes(f)) problems.push(`${f} is listed but not a tracked test`);
if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
}

let wanted = process.argv.slice(2);
if (!wanted.length || wanted.includes('all')) wanted = NAMES;
const unknown = wanted.filter((t) => !NAMES.includes(t));
if (unknown.length) { console.error(`unknown tier: ${unknown.join(', ')} (tiers: ${NAMES.join(', ')}, all)`); process.exit(2); }

const LIMIT = Number(process.env.TEST_TIMEOUT || 900) * 1000;

/** Runs one file; resolves its exit status, or 'stuck' when it was killed at the limit. */
function run(f: string): Promise<number | 'stuck'> {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const child = spawn(process.execPath, [f], { cwd: ROOT, stdio: 'inherit' });
        let stuck = false;
        const tick = setInterval(() => {
            const s = Math.round((Date.now() - t0) / 1000);
            if (Date.now() - t0 >= LIMIT) { stuck = true; console.error(`\n[test] ${f}: stuck after ${s} s, killed`); child.kill('SIGKILL'); }
            else console.error(`\n[test] ${f}: still running after ${s} s`);
        }, Math.min(60_000, LIMIT));
        child.on('close', (code) => { clearInterval(tick); resolve(stuck ? 'stuck' : code ?? 1); });
    });
}

const failed: string[] = [];
const stuck: string[] = [];
const started = Date.now();
let count = 0;
for (const tier of wanted) {
    for (const f of tiers[tier] as string[]) {
        count++;
        const r = await run(f);
        if (r === 'stuck') stuck.push(f);
        else if (r !== 0) failed.push(f);
    }
}
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\ntests (${wanted.join(', ')}): ${count} files in ${secs} s, ${failed.length + stuck.length} failed`);
for (const f of failed) console.log(`  failed: ${f}`);
for (const f of stuck) console.log(`  stuck: ${f} (killed after ${LIMIT / 1000} s; TEST_TIMEOUT raises it)`);
process.exitCode = failed.length + stuck.length ? 1 : 0;
