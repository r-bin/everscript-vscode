// AI context budget (docs/cleanup.md D10, 7.1): the files agents load stay small and their links work.
//   node tools/check-ai-context.mts         report; fails on overruns that are not in the allowance list
// Limits: root AGENTS.md <= 150 lines; each SKILL.md <= 200 lines; a skill description <= 2 lines of
// ~100 characters (200); nested AGENTS.md <= 70 lines; no relative link or `path` mention to a
// missing repo file in these files.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
// Known overruns, removed as cleanup step 7 slims them. Only ever shrinks.
const ALLOW = new Set<string>(JSON.parse(readFileSync(join(ROOT, 'tools/check-ai-context.allow.json'), 'utf8')).allow);

type Problem = { file: string; what: string };
const problems: Problem[] = [];
const lines = (f: string) => readFileSync(f, 'utf8').split('\n').length;

function limit(file: string, max: number) {
    const n = lines(join(ROOT, file));
    if (n > max) problems.push({ file, what: `${n} lines (max ${max})` });
}

function links(file: string) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const base = dirname(join(ROOT, file));
    const refs = new Set<string>();
    // A markdown link is relative to the file; agents also write repo-root paths in links, so either counts.
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(m[1]) || m[1].startsWith('UPSTREAM')) continue;
        if (!existsSync(join(base, m[1]))) refs.add(join(ROOT, m[1]));
    }
    for (const m of text.matchAll(/`((?:src|docs|tools|tests|scripts|\.agents)\/[\w./-]+\.\w+)`/g)) refs.add(join(ROOT, m[1]));
    for (const r of refs) if (!r.includes('*') && !r.includes('<') && !existsSync(r)) problems.push({ file, what: `missing ${r.slice(ROOT.length + 1)}` });
}

limit('AGENTS.md', 150);
links('AGENTS.md');
links('AI_ARCHITECTURE_GUIDE.md');
const skills = join(ROOT, '.agents/skills');
for (const s of readdirSync(skills)) {
    const f = `.agents/skills/${s}/SKILL.md`;
    if (!existsSync(join(ROOT, f))) continue;
    limit(f, 200);
    links(f);
    const desc = readFileSync(join(ROOT, f), 'utf8').match(/^description:\s*(.*)$/m)?.[1] ?? '';
    if (desc.length > 200) problems.push({ file: f, what: `description ${desc.length} chars (max 200)` });
}
const walk = (d: string): string[] => readdirSync(join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (['node_modules', 'dist', 'core'].includes(e.name) && d === 'src/emulator' ? [] : walk(`${d}/${e.name}`))
        : e.name === 'AGENTS.md' ? [`${d}/${e.name}`] : []);
for (const f of walk('src')) { limit(f, 70); links(f); }

const key = (p: Problem) => `${p.file}: ${p.what.replace(/\d+ (lines|chars)/, 'N $1')}`;
const fresh = problems.filter((p) => !ALLOW.has(key(p)));
if (process.argv.includes('--list')) for (const p of problems) console.log(key(p));
for (const p of fresh) console.log(`${p.file}: ${p.what}`);
console.log(`check:ai-context: ${problems.length} problems, ${problems.length - fresh.length} allowed (cleanup step 7), ${fresh.length} new`);
process.exitCode = fresh.length ? 1 : 0;
