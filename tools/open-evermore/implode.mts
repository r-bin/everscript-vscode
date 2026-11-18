// Implode: the folder → a ROM, validated before and after (docs/open-evermore/tool.md §3, validation.md §2).
//   npm run implode -- <dir> [--check-only] [--strict]
//   → <dir>/_build/evermore.sfc (only when there is no error), report.md, report.json
// Until code is a kind, implode writes the bytes itself; no Asar.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Write } from './codec.mts';
import { explode } from './explode.mts';
import { GAME, KINDS } from './evermore/kinds.mts';
import { Findings } from './findings.mts';
import { FILE as MANIFEST, busOf, checkHeader, checkManifest, fileOf, formatAddr, parseAddr } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { markdown, terminal } from './report.mts';
import { BUILD_DIR, diffTrees, readText, readTree, sha1 } from './tree.mts';
import type { Tree } from './tree.mts';

const FILL = 0xFF;

export interface KindStats { kind: string; files: number; bytes: number; changed: boolean }

export interface Result {
    findings: Findings;
    /** The built ROM; null when validation failed before building, or with --check-only. */
    image: Uint8Array | null;
    stats: KindStats[];
    sha1: string | null;
}

export function implode(tree: Tree, opts: { checkOnly?: boolean } = {}): Result {
    const findings = new Findings();
    const fail = (): Result => ({ findings, image: null, stats: [], sha1: null });

    // Stage 1: the manifest.
    const raw = tree.get(MANIFEST);
    if (!raw) { findings.error('missing-file', MANIFEST, '', 'the manifest is missing'); return fail(); }
    let manifest: Manifest;
    try { manifest = JSON.parse(readText(raw)); }
    catch (e) { findings.error('parse-error', MANIFEST, '', (e as Error).message); return fail(); }
    if (manifest.game !== GAME) findings.error('schema', MANIFEST, '/game', `this tool builds "${GAME}"`);
    const size = checkManifest(manifest, findings);
    if (size === null || findings.failed) return fail();

    // Stages 2-3: every kind reads, resolves and checks its files.
    const writes: Write[] = [];
    const stats: KindStats[] = [];
    let changed = false;
    for (const codec of KINDS) {
        const out = codec.implode({ tree, manifest, size, findings });
        writes.push(...out.writes);
        changed ||= out.changed;
        const files = [...tree.keys()].filter(p => p === codec.path || p.startsWith(codec.path + '/')).length;
        stats.push({ kind: codec.kind, files, bytes: out.writes.reduce((s, w) => s + w.bytes.length, 0), changed: out.changed });
    }
    for (const path of tree.keys()) {
        const top = path.split('/')[0];
        if (path !== MANIFEST && !KINDS.some(k => k.path === top)) findings.warning('unknown-file', path, '', 'no kind owns this path; ignored');
    }

    // Stage 5: every write inside the image, inside a region that holds resources, and no two on the same byte.
    const spans = manifest.regions.map(r => ({ r, from: fileOf(parseAddr(r.from)!), to: fileOf(parseAddr(r.to)!) }));
    const owner = new Array<string | undefined>(size);
    let written = 0;
    for (const w of writes) {
        const end = w.at + w.bytes.length;
        if (w.at < 0 || end > size) { findings.error('outside-image', w.file, '', `${formatAddr(busOf(w.at))}+${w.bytes.length} is outside the ${manifest.memoryMap.size} image`); continue; }
        const region = spans.find(s => w.at >= s.from && end - 1 <= s.to);
        if (!region || (region.r.use !== 'resources' && region.r.use !== 'header')) {
            findings.error('wrong-region', w.file, '', `${formatAddr(busOf(w.at))} is not inside one region that holds resources`);
        }
        for (let i = w.at; i < end; i++) {
            if (owner[i] !== undefined) { findings.error('write-overlap', w.file, '', `${formatAddr(busOf(i))} is also written by ${owner[i]}`); break; }
            owner[i] = w.file;
        }
        written += w.bytes.length;
    }
    if (findings.failed || opts.checkOnly) return { findings, image: null, stats, sha1: null };
    if (written < size) findings.info('unwritten', MANIFEST, '/regions', `${size - written} bytes no resource writes, filled with $${FILL.toString(16).toUpperCase()}`);

    // Stage 6: build.
    const image = new Uint8Array(size).fill(FILL);
    for (const w of writes) image.set(w.bytes, w.at);
    const hash = sha1(image);

    // Stage 7: after.
    checkHeader(manifest, image, findings);
    if (!changed && hash !== manifest.base.sha1) {
        findings.error('g0-failed', MANIFEST, '/base/sha1', `nothing changed since explode, yet the ROM's sha1 is ${hash}`);
    }
    const ignored = new Set(findings.list.filter(f => f.rule === 'unknown-file').map(f => f.file));
    const again = explode(image, manifest.base);
    const differ = diffTrees(again, tree).filter(p => p !== MANIFEST && !ignored.has(p));
    for (const p of differ.slice(0, 20)) findings.error('round-trip', p, '', again.has(p) ? (tree.has(p) ? 'explodes to different content' : 'explode writes this file; the tree lacks it') : 'explode does not give this file back');
    if (differ.length > 20) findings.error('round-trip', MANIFEST, '', `${differ.length - 20} more files differ`);
    if (changed) findings.info('changed', MANIFEST, '', 'resources changed since explode: G0 not checked; prove with playbacks (G1/G2)');
    return { findings, image: findings.failed ? null : image, stats, sha1: hash };
}

function main(): void {
    const args = process.argv.slice(2);
    const take = (name: string) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
    const checkOnly = take('--check-only'), strict = take('--strict');
    if (!args[0]) { console.error('usage: npm run implode -- <dir> [--check-only] [--strict]'); process.exit(2); }
    const dir = resolve(args[0]);
    const result = implode(readTree(dir), { checkOnly });
    if (strict) for (const f of result.findings.list) if (f.severity === 'warning') f.severity = 'error';

    const build = join(dir, BUILD_DIR);
    rmSync(join(build, 'evermore.sfc'), { force: true });
    mkdirSync(build, { recursive: true });
    if (result.image && !result.findings.failed) writeFileSync(join(build, 'evermore.sfc'), result.image);
    writeFileSync(join(build, 'report.json'), JSON.stringify({ sha1: result.sha1, stats: result.stats, findings: result.findings.list }, null, 2) + '\n');
    writeFileSync(join(build, 'report.md'), markdown(dir, result));
    console.log(terminal(dir, result, checkOnly));
    process.exitCode = result.findings.failed ? 1 : 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
