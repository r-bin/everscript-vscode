// Runs test tiers (tests/tiers.json; docs/cleanup.md 6.6, AI_ARCHITECTURE_GUIDE.md §4).
//   node tools/test.mts unit             one tier; several: unit rom dom; all: every tier
// Each test file runs in its own node process, in order; the run fails if any file fails, and
// before running it fails if a tests/**/*.test.js is in no tier (or in two), so none is forgotten.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

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

const failed: string[] = [];
const started = Date.now();
let count = 0;
for (const tier of wanted) {
    for (const f of tiers[tier] as string[]) {
        count++;
        const r = spawnSync(process.execPath, [f], { cwd: ROOT, stdio: 'inherit' });
        if (r.status !== 0) failed.push(f);
    }
}
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\ntests (${wanted.join(', ')}): ${count} files in ${secs} s, ${failed.length} failed`);
for (const f of failed) console.log(`  failed: ${f}`);
process.exitCode = failed.length ? 1 : 0;
