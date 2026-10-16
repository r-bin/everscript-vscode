// Legal check (docs/cleanup.md 1.1, AI_ARCHITECTURE_GUIDE.md §3.8).
//
//   node tools/check-legal.mts              tracked files; fails on anything not in the baseline
//   node tools/check-legal.mts --staged     only staged files (release ritual)
//   node tools/check-legal.mts --history    every commit; rewrites docs/legal-history.md
//   node tools/check-legal.mts --baseline   rewrite tools/check-legal.baseline.json from the tree
//
// The baseline lists known violations (path + rule) that a cleanup step still has to remove;
// it may only shrink. A finding that is not in it fails the check.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

type Finding = { path: string; rule: string; detail: string };

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'tools/check-legal.baseline.json');
const HISTORY_DOC = join(ROOT, 'docs/legal-history.md');

const FORBIDDEN_EXT = /\.(smc|sfc|swc|fig|srm|sav|state|spc|brr|wav|ips|bps|ups|png|gif|jpe?g|bmp|pyc)$/i;
const MAGIC: [string, Buffer][] = [
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['gif', Buffer.from('GIF8')],
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff])],
    ['spc', Buffer.from('SNES-SPC700')],
    ['ips', Buffer.from('PATCH')],
    ['bps', Buffer.from('BPS1')],
    ['ups', Buffer.from('UPS1')],
    ['wav', Buffer.from('RIFF')],
];
// Third-party projects we must not build on, and their source file names.
const UPSTREAM = /SoETilesViewer|SoEScriptDumper|SoE[ -]?tiles[ -]?viewer|list-rooms\.cpp|characterdata\.h|spriteblock\.h|spriteinfo\.h|frameview\.cpp|buf_parse_sub|script_all\b/i;
// Files that state the ban (they have to name what is banned).
const POLICY_FILES = new Set([
    'AGENTS.md',
    'AI_ARCHITECTURE_GUIDE.md',
    'docs/cleanup.md',
    'docs/legal-history.md',
    'docs/plans/script-decoder-from-game-code.md',
    'tools/check-legal.mts',
    'tools/check-legal.baseline.json',
    '.gitignore',
]);
const CODE_EXT = /\.(js|ts|mts|mjs|cjs|json|sh|py)$/i;
const TEXT_EXT = /\.(js|ts|mts|mjs|cjs|json|md|css|html|sh|py|evs|c|h|txt|yml|yaml|svg)$/i;

function lineOf(text: string, index: number): number {
    return text.slice(0, index).split('\n').length;
}

/** Content rules for one file; `path` is repo-relative. */
export function checkContent(path: string, buf: Buffer): Finding[] {
    const out: Finding[] = [];
    if (FORBIDDEN_EXT.test(path)) out.push({ path, rule: 'extension', detail: path.split('.').pop() ?? '' });
    for (const [kind, magic] of MAGIC) {
        if (buf.length >= magic.length && buf.subarray(0, magic.length).equals(magic)) {
            out.push({ path, rule: 'magic', detail: kind });
        }
    }
    if (!TEXT_EXT.test(path) && !/(^|\/)[^.]+$/.test(path)) return out;
    const text = buf.toString('utf8');

    // A data: URI built at runtime is fine; an embedded one carries its payload in the source.
    const dataUri = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]{40}/i.exec(text);
    if (dataUri) out.push({ path, rule: 'data-uri', detail: `line ${lineOf(text, dataUri.index)}` });
    const b64 = /[A-Za-z0-9+/]{200,}={0,2}/.exec(text);
    if (b64) out.push({ path, rule: 'base64', detail: `line ${lineOf(text, b64.index)}` });

    const nums = /(?:(?:0x[0-9a-fA-F]+|\$[0-9a-fA-F]+|-?\d+)\s*,\s*){63,}(?:0x[0-9a-fA-F]+|\$[0-9a-fA-F]+|-?\d+)/.exec(text);
    if (nums) out.push({ path, rule: 'number-run', detail: `line ${lineOf(text, nums.index)}` });

    let run = 0;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        run = /(?:^|\s)(?:[0-9A-Fa-f]{2}[ \t]+){7,}[0-9A-Fa-f]{2}(?:\s|$)/.test(lines[i]) ? run + 1 : 0;
        if (run === 4) { out.push({ path, rule: 'hex-dump', detail: `line ${i - 2}` }); break; }
    }

    const home = /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[^\s'"`)]*/.exec(text);
    if (home) out.push({ path, rule: 'home-path', detail: `line ${lineOf(text, home.index)}` });
    // A ROM file name in code is a hard-coded ROM path; the ROM comes from soe:// (cleanup D5).
    const romName = CODE_EXT.test(path) ? /[\w ()[\]!,.'-]+\.(?:smc|sfc)\b/i.exec(text) : null;
    if (romName && /\((?:U|E|G|J|USA|Europe|Germany|Japan)\)/i.test(romName[0])) {
        out.push({ path, rule: 'rom-name', detail: `line ${lineOf(text, romName.index)}` });
    }
    if (!POLICY_FILES.has(path)) {
        const up = UPSTREAM.exec(text);
        if (up) out.push({ path, rule: 'upstream', detail: `line ${lineOf(text, up.index)}: ${up[0]}` });
    }
    return out;
}

function git(args: string[], input?: string): string {
    return execFileSync('git', args, { cwd: ROOT, input, maxBuffer: 2 ** 30 }).toString();
}

/** Reads many blobs in one `git cat-file --batch` process. */
function readBlobs(all: string[]): Map<string, Buffer> {
    const out = new Map<string, Buffer>();
    for (let i = 0; i < all.length; i += 1000) readBlobChunk(all.slice(i, i + 1000), out);
    return out;
}

function readBlobChunk(ids: string[], out: Map<string, Buffer>): void {
    const raw = execFileSync('git', ['cat-file', '--batch'], { cwd: ROOT, input: ids.join('\n') + '\n', maxBuffer: 2 ** 31 });
    let at = 0;
    for (const id of ids) {
        const nl = raw.indexOf(0x0a, at);
        const header = raw.subarray(at, nl).toString();
        const size = Number(header.split(' ')[2]);
        if (header.endsWith('missing') || Number.isNaN(size)) { at = nl + 1; continue; }
        out.set(id, raw.subarray(nl + 1, nl + 1 + size));
        at = nl + 1 + size + 1;
    }
}

// Content that may be game data or third-party work; home paths and ROM file names only leak setup.
const SEVERE = new Set(['extension', 'magic', 'data-uri', 'base64', 'number-run', 'hex-dump', 'upstream']);
const key = (f: Finding) => `${f.path}\t${f.rule}`;

function checkFiles(paths: string[], read: (p: string) => Buffer): Finding[] {
    return paths.flatMap((p) => checkContent(p, read(p)));
}

function trackedFiles(): string[] {
    // Gitlinks (submodules) are other repositories; they have their own licences.
    return git(['ls-files', '-s']).split('\n').filter((l) => l && !l.startsWith('160000') && !l.startsWith('120000'))
        .map((l) => l.split('\t')[1]).filter((p) => existsSync(join(ROOT, p)));
}

function runTree(staged: boolean): number {
    const paths = staged
        ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean)
        : trackedFiles();
    const findings = staged
        ? (() => {
            const ids = paths.map((p) => git(['rev-parse', `:${p}`]).trim());
            const blobs = readBlobs(ids);
            return paths.flatMap((p, i) => (blobs.has(ids[i]) ? checkContent(p, blobs.get(ids[i])!) : []));
        })()
        : checkFiles(paths, (p) => readFileSync(join(ROOT, p)));
    const baseline = new Set<string>(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).known.map((k: string[]) => k.join('\t')) : []);
    const fresh = findings.filter((f) => !baseline.has(key(f)));
    const known = findings.length - fresh.length;
    if (!staged) {
        const seen = new Set(findings.map(key));
        const gone = [...baseline].filter((k) => !seen.has(k));
        if (gone.length) console.log(`${gone.length} baseline entries are fixed; run --baseline to drop them:\n  ${gone.join('\n  ')}`);
    }
    for (const f of fresh) console.log(`${f.path}: ${f.rule} (${f.detail})`);
    console.log(`check:legal: ${paths.length} files, ${fresh.length} new findings, ${known} known (baseline)`);
    return fresh.length ? 1 : 0;
}

function writeBaseline(): number {
    const findings = checkFiles(trackedFiles(), (p) => readFileSync(join(ROOT, p)));
    const known = [...new Set(findings.map(key))].sort().map((k) => k.split('\t'));
    writeFileSync(BASELINE, JSON.stringify({
        '//': 'Known legal findings still to remove (docs/cleanup.md). Only ever shrinks: node tools/check-legal.mts --baseline',
        known,
    }, null, 1) + '\n');
    console.log(`baseline: ${known.length} entries`);
    return 0;
}

function runHistory(): number {
    // Every blob each commit introduced, checked once.
    const log = git(['log', '--all', '--reverse', '--format=@%H%x09%ad%x09%s', '--date=short', '--raw', '--no-renames', '--no-abbrev']);
    type Commit = { hash: string; date: string; subject: string; adds: [string, string][] };
    const commits: Commit[] = [];
    for (const line of log.split('\n')) {
        if (line.startsWith('@')) {
            const [hash, date, ...rest] = line.slice(1).split('\t');
            commits.push({ hash, date, subject: rest.join('\t'), adds: [] });
        } else if (line.startsWith(':')) {
            const [meta, path] = line.split('\t');
            // ":<old mode> <new mode> <old id> <new id> <status>"
            const [, newMode, , id, status] = meta.split(' ');
            if (status === 'D' || /^0+$/.test(id) || newMode === '160000' || newMode === '120000') continue;
            commits[commits.length - 1]?.adds.push([path, id]);
        }
    }
    const ids = [...new Set(commits.flatMap((c) => c.adds.map(([, id]) => id)))];
    const blobs = readBlobs(ids);
    const verdict = new Map<string, Finding[]>();
    const rows: string[] = [];
    let bad = 0;
    let minor = 0;
    for (const c of commits) {
        const hits: string[] = [];
        let minorHits = 0;
        for (const [path, id] of c.adds) {
            const blob = blobs.get(id);
            if (!blob) continue;
            const k = `${path}\0${id}`;
            if (!verdict.has(k)) verdict.set(k, checkContent(path, blob));
            for (const f of verdict.get(k)!) {
                if (SEVERE.has(f.rule)) hits.push(`\`${f.path}\` ${f.rule}`);
                else minorHits++;
            }
        }
        if (minorHits && !hits.length) minor++;
        const msg = UPSTREAM.test(c.subject) ? ' · message names upstream' : '';
        if (!hits.length && !msg) continue;
        bad++;
        const shown = [...new Set(hits)];
        rows.push(`- \`${c.hash.slice(0, 8)}\` ${c.date} ${c.subject.replace(/\|/g, '\\|')}${msg}`
            + (shown.length ? `\n  ${shown.slice(0, 12).join(', ')}${shown.length > 12 ? `, … (+${shown.length - 12})` : ''}` : ''));
    }
    writeFileSync(HISTORY_DOC, [
        '# Legal findings in git history',
        '',
        'Generated by `node tools/check-legal.mts --history` — do not edit. Kept as a known future',
        'problem (docs/cleanup.md D2, §4): each commit below added content that `check:legal` flags.',
        'Listed: possible game data (extension, magic bytes, data URIs, base64, number runs, hex dumps)',
        'and mentions of the upstream projects. Not listed: commits that only add home-directory',
        'paths or ROM file names. The way out is in docs/cleanup.md §4.',
        '',
        `${bad} of ${commits.length} commits listed; ${minor} more only add home paths or ROM file names.`,
        '',
        ...rows,
        '',
    ].join('\n'));
    console.log(`history: ${bad} of ${commits.length} commits listed, ${minor} minor → docs/legal-history.md`);
    return 0;
}

const arg = process.argv[2];
process.exitCode = arg === '--history' ? runHistory()
    : arg === '--baseline' ? writeBaseline()
    : runTree(arg === '--staged');
