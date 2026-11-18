// Implode: the folder → a ROM, validated before and after (docs/open-evermore/tool.md §3, validation.md §2).
// Every resource goes wherever the allocator puts it: in its old place (stable, the default) or shuffled
// (`seed`), which proves that nothing reaches it by a fixed address. CLI: open-evermore.mts.
import { readBase, DIR as BASE_DIR } from './base.mts';
import { ENUM, resolveEnum } from './enum.mts';
import type { Codec, Item, Span, Write } from './codec.mts';
import { explode } from './explode.mts';
import { Findings } from './findings.mts';
import { FILE as MANIFEST, busOf, checkHeader, checkManifest, fileOf, formatAddr, parseAddr, writeChecksum } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { allocate } from './layout.mts';
import { diffTrees, readText, sha1 } from './tree.mts';
import type { Tree } from './tree.mts';

export interface KindStats { kind: string; items: number; bytes: number; changed: number; moved: number }

export interface Result {
    findings: Findings;
    /** The built ROM; null on an error, or with checkOnly. */
    image: Uint8Array | null;
    stats: KindStats[];
    sha1: string | null;
    seed: number | null;
    /** Where each resource was (home) and where this build put it. */
    placed: { key: string; home: number | undefined; at: number; length: number; changed: boolean }[];
}

export interface Options { checkOnly?: boolean; seed?: number }

export function implode(tree: Tree, game: string, kinds: Codec[], opts: Options = {}): Result {
    const findings = new Findings();
    const seed = opts.seed ?? null;
    const placed: Result['placed'] = [];
    const done = (image: Uint8Array | null = null, stats: KindStats[] = [], hash: string | null = null): Result =>
        ({ findings, image: findings.failed ? null : image, stats, sha1: hash, seed, placed });

    // Stage 1: the manifest and the base.
    const raw = tree.get(MANIFEST);
    if (!raw) { findings.error('missing-file', MANIFEST, '', 'the manifest is missing'); return done(); }
    let manifest: Manifest;
    try { manifest = JSON.parse(readText(raw)); }
    catch (e) { findings.error('parse-error', MANIFEST, '', (e as Error).message); return done(); }
    if (manifest.game !== game) findings.error('schema', MANIFEST, '/game', `this tool builds "${game}"`);
    const size = checkManifest(manifest, findings);
    if (size === null || findings.failed) return done();
    const base = readBase(tree, size, findings);
    if (!base) return done();

    // Stage 2: names → ids, one enum per kind.  Stage 3: every kind checks and encodes its resources.
    const ctx = { tree, manifest, size, base, findings, ids: new Map<string, Map<string, number>>() };
    const items: Item[] = [];
    const stats: KindStats[] = [];
    for (const codec of kinds) {
        const names = codec.names(ctx);
        const path = `${codec.path}/${ENUM}`;
        const ids = resolveEnum(path, tree.get(path), names, findings);
        if (ids) ctx.ids.set(codec.kind, ids);
        const list = codec.encode(ctx, names);
        items.push(...list);
        const changed = list.filter(i => base.homeSha1.get(i.key) !== sha1(i.bytes)).length;
        stats.push({ kind: codec.kind, items: list.length, bytes: list.reduce((s, i) => s + i.bytes.length, 0), changed, moved: 0 });
    }
    for (const path of tree.keys()) {
        const top = path.split('/')[0];
        if (path !== MANIFEST && top !== BASE_DIR && !kinds.some(k => k.path === top)) findings.warning('unknown-file', path, '', 'no kind owns this path; ignored');
    }
    const removed = [...base.homes.keys()].filter(key => !items.some(i => i.key === key));
    const reordered = [...base.enumSha1].filter(([path, hash]) => { const now = tree.get(path); return !now || sha1(now) !== hash; }).length;
    const changed = stats.some(s => s.changed > 0) || removed.length > 0 || reordered > 0;
    if (findings.failed) return done(null, stats);

    // Stage 5: placement. Free space: the pool the kinds gave up, plus manifest regions marked free.
    const extra: Span[] = manifest.regions.filter(r => r.use === 'free').map(r => ({ start: fileOf(parseAddr(r.from)!), end: fileOf(parseAddr(r.to)!) + 1 }));
    const layout = allocate(items, base.pool, extra, base.homes, opts.seed);
    for (const item of layout.failed) findings.error('no-space', item.file, '', `no free space for ${item.bytes.length} bytes under its rule ${JSON.stringify(item.rule)}`);
    for (const item of items) if (layout.at.has(item.key)) placed.push({ key: item.key, home: base.homes.get(item.key)?.at, at: layout.at.get(item.key)!, length: item.bytes.length, changed: base.homeSha1.get(item.key) !== sha1(item.bytes) });
    for (const s of stats) s.moved = items.filter(i => i.key.startsWith(s.kind + '/') && layout.at.get(i.key) !== base.homes.get(i.key)?.at).length;
    if (findings.failed || opts.checkOnly) return done(null, stats);

    // Stage 6: build. The base, the items where they landed, the tables that point at them, the checksum.
    const image = base.image.slice();
    for (const item of items) image.set(item.bytes, layout.at.get(item.key)!);
    const writes: Write[] = kinds.flatMap(codec => codec.tables(ctx, layout.at));
    const tables = base.tables;
    for (const w of writes) {
        if (!tables.some(t => w.at >= t.start && w.at + w.bytes.length <= t.end)) findings.error('wrong-region', w.file, '', `generated table at ${formatAddr(busOf(w.at))} lies outside the table space explode recorded`);
        else image.set(w.bytes, w.at);
    }
    writeChecksum(image);
    const hash = sha1(image);

    // Stage 7: after.
    checkHeader(manifest, image, findings);
    if (seed === null && !changed && hash !== manifest.base.sha1) {
        findings.error('g0-failed', MANIFEST, '/base/sha1', `nothing changed since explode, yet the ROM's sha1 is ${hash}`);
    }
    const ignored = new Set(findings.list.filter(f => f.rule === 'unknown-file').map(f => f.file));
    const byId = new Map([...ctx.ids].map(([kind, ids]) => {
        const list: (string | null)[] = [];
        for (const [name, id] of ids) list[id] = name;
        return [kind, Array.from(list, n => n ?? null)];
    }));
    const again = explode(image, manifest.base, game, kinds, byId);
    const own = (p: string) => p !== MANIFEST && !p.startsWith(BASE_DIR + '/') && !ignored.has(p);
    const differ = diffTrees(new Map([...again].filter(([p]) => own(p))), new Map([...tree].filter(([p]) => own(p))));
    for (const p of differ.slice(0, 20)) findings.error('round-trip', p, '', again.has(p) ? (tree.has(p) ? 'explodes to different content' : 'explode writes this file; the tree lacks it') : 'explode does not give this file back');
    if (differ.length > 20) findings.error('round-trip', MANIFEST, '', `${differ.length - 20} more files differ`);
    if (changed) findings.info('changed', MANIFEST, '', 'resources changed since explode: G0 not checked; prove with playbacks (G1/G2)');
    if (seed !== null) findings.info('random', MANIFEST, '', `random layout, seed ${seed}: ${layout.moved} of ${items.length} resources moved; prove with playbacks`);
    return done(image, stats, hash);
}
