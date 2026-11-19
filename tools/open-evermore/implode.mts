// Implode: the folder → a ROM, validated before and after (docs/open-evermore/tool.md §3, validation.md §2).
// Every resource goes wherever the allocator puts it: in its old place (stable, the default) or shuffled
// (`seed`), which proves that nothing reaches it by a fixed address. CLI: open-evermore.mts.
import { readBase, DIR as BASE_DIR } from './base.mts';
import { ENUM, resolveEnum } from './enum.mts';
import type { Codec, Item, Span, Write } from './codec.mts';
import { explode } from './explode.mts';
import { Findings } from './findings.mts';
import { FILE as MANIFEST, busOf, checkHeader, checkManifest, checkRegions, fileOf, formatAddr, parseAddr } from './manifest.mts';
import type { Layout, Manifest } from './manifest.mts';
import { allocate } from './layout.mts';
import { plan } from './layouts.mts';
import type { PastEnd, Plan } from './layouts.mts';
import { diffTrees, readText, sha1 } from './tree.mts';
import type { Tree } from './tree.mts';

/** The largest HiROM image ($C0-$FF). */
const FOUR_MIB = 0x400000;
const EIGHT_MIB = 0x800000;

export interface KindStats { kind: string; items: number; bytes: number; changed: number; moved: number }

export interface Result {
    findings: Findings;
    /** The built ROM; null on an error, or with checkOnly. */
    image: Uint8Array | null;
    /** The HiROM content it was built from (the image itself for hirom; what an sa1 image holds in both views). */
    content: Uint8Array | null;
    layout: string | null;
    stats: KindStats[];
    sha1: string | null;
    seed: number | null;
    /** Where each resource was (home) and where this build put it. */
    placed: { key: string; home: number | undefined; at: number; length: number; changed: boolean }[];
}

export interface Options {
    checkOnly?: boolean;
    seed?: number;
    /** Build this layout, at its smallest, without growing (prove builds the original as plain hirom). */
    layout?: Layout;
    /** Bytes the game reads past the base image (layouts.mts PastEnd; Evermore: evermore/kinds.mts PAST_END). */
    pastEnd?: PastEnd[];
}

/** The plans to try, smallest first: hirom grows to 4 MiB, then to exhirom (manifest `grow`, default on). */
function plans(manifest: Manifest, size: number, baseLength: number, opts: Options): Plan[] {
    const layout = opts.layout ?? manifest.memoryMap.layout, past = opts.pastEnd ?? [];
    if (layout === 'exhirom') return [plan('exhirom', EIGHT_MIB, baseLength, past)];
    if (layout === 'sa1') return [plan('sa1', FOUR_MIB, baseLength, past)];
    const grow = !opts.layout && manifest.memoryMap.grow !== false;
    // A random layout starts at 4 MiB: with room to spare, half the resources leave their home span.
    const first = opts.layout ? baseLength : opts.seed !== undefined && grow ? FOUR_MIB : Math.min(FOUR_MIB, Math.max(size, baseLength));
    const sizes = [...new Set([first, ...(grow ? [FOUR_MIB] : [])])];
    return [...sizes.map(n => plan('hirom', n, baseLength, past)), ...(grow ? [plan('exhirom', EIGHT_MIB, baseLength, past)] : [])];
}

export function implode(tree: Tree, game: string, kinds: Codec[], opts: Options = {}): Result {
    const findings = new Findings();
    const seed = opts.seed ?? null;
    const placed: Result['placed'] = [];
    let built: Uint8Array | null = null, label: string | null = null;
    const done = (image: Uint8Array | null = null, stats: KindStats[] = [], hash: string | null = null): Result =>
        ({ findings, image: findings.failed ? null : image, content: findings.failed ? null : built, layout: label, stats, sha1: hash, seed, placed });

    // Stage 1: the manifest and the base.
    const raw = tree.get(MANIFEST);
    if (!raw) { findings.error('missing-file', MANIFEST, '', 'the manifest is missing'); return done(); }
    let manifest: Manifest;
    try { manifest = JSON.parse(readText(raw)); }
    catch (e) { findings.error('parse-error', MANIFEST, '', (e as Error).message); return done(); }
    if (manifest.game !== game) findings.error('schema', MANIFEST, '/game', `this tool builds "${game}"`);
    const size = checkManifest(manifest, findings);
    if (size === null || findings.failed) return done();
    const base = readBase(tree, findings);
    if (!base) return done();
    checkRegions(manifest, base.image.length, findings);
    if (manifest.memoryMap.layout === 'hirom' && size < base.image.length) findings.error('size-mismatch', MANIFEST, '/memoryMap/size', `${manifest.memoryMap.size} is smaller than the base image`);
    if (findings.failed) return done();

    // Stage 2: names → ids, one enum per kind.  Stage 3: every kind checks and encodes its resources.
    let chosen: Plan | null = null;
    const ctx = {
        tree, manifest, size, base, findings, ids: new Map<string, Map<string, number>>(), marks: new Map<string, Set<string>>(),
        pointer: (at: number) => chosen!.pointer(at),
    };
    const items: Item[] = [];
    const stats: KindStats[] = [];
    // Every enum first: a kind's resources reference other kinds by name.
    const present = new Map<string, Set<string>>();
    for (const codec of kinds) {
        const names = codec.names(ctx);
        present.set(codec.kind, names);
        const path = `${codec.path}/${ENUM}`;
        const ids = resolveEnum(path, tree.get(path), names, findings);
        if (ids) ctx.ids.set(codec.kind, ids);
    }
    // In the order of `kinds`: a kind that marks another's resources (ctx.marks) encodes before it.
    for (const codec of kinds) {
        const list = codec.encode(ctx, present.get(codec.kind)!);
        items.push(...list);
        const changed = list.filter(i => base.homeSha1.get(i.key) !== sha1(i.bytes)).length;
        stats.push({ kind: codec.kind, items: list.length, bytes: list.reduce((s, i) => s + i.bytes.length, 0), changed, moved: 0 });
    }
    for (const path of tree.keys()) {
        const top = path.split('/')[0];
        if (path !== MANIFEST && top !== BASE_DIR && !kinds.some(k => k.path === top)) findings.warning('unknown-file', path, '', 'no kind owns this path; ignored');
    }
    const keys = new Set(items.map(i => i.key));
    const removed = [...base.homes.keys()].filter(key => !keys.has(key));
    const reordered = [...base.enumSha1].filter(([path, hash]) => { const now = tree.get(path); return !now || sha1(now) !== hash; }).length;
    const changed = stats.some(s => s.changed > 0) || removed.length > 0 || reordered > 0;
    if (findings.failed) return done(null, stats);

    // Stage 5: placement. Free space: the pool the kinds gave up, manifest regions marked free, and what the layout
    // adds beyond the base; the first plan that holds every resource wins (a stable tree fits the first: G0).
    const free: Span[] = manifest.regions.filter(r => r.use === 'free').map(r => ({ start: fileOf(parseAddr(r.from)!), end: fileOf(parseAddr(r.to)!) + 1 }));
    const tried = plans(manifest, size, base.image.length, opts);
    let layout = allocate(items, base.pool, free, base.homes, opts.seed);
    for (const p of tried) {
        chosen = p;
        layout = allocate(items, base.pool, [...free, ...p.free], base.homes, opts.seed);
        if (!layout.failed.length) break;
    }
    if (chosen !== tried[0]) findings.info('grown', MANIFEST, '/memoryMap', `${tried[0].label} did not hold every resource: built as ${chosen!.label}`);
    for (const item of layout.failed) findings.error('no-space', item.file, '', `no free space for ${item.bytes.length} bytes under its rule ${JSON.stringify(item.rule)}`);
    for (const item of items) if (layout.at.has(item.key)) placed.push({ key: item.key, home: base.homes.get(item.key)?.at, at: layout.at.get(item.key)!, length: item.bytes.length, changed: base.homeSha1.get(item.key) !== sha1(item.bytes) });
    for (const s of stats) s.moved = items.filter(i => i.key.startsWith(s.kind + '/') && layout.at.get(i.key) !== base.homes.get(i.key)?.at).length;
    if (findings.failed || opts.checkOnly) return done(null, stats);

    // Stage 6: build. The content (base, items where they landed, the tables that point at them), then the
    // layout's cartridge image with its checksum.
    const p = chosen!;
    const content = new Uint8Array(p.content).fill(0xFF);
    content.set(base.image);
    p.prepare(content, base.image.length);
    for (const item of items) content.set(item.bytes, layout.at.get(item.key)!);
    const writes: Write[] = kinds.flatMap(codec => codec.tables(ctx, layout.at));
    const tables = base.tables;
    for (const w of writes) {
        if (!tables.some(t => w.at >= t.start && w.at + w.bytes.length <= t.end)) findings.error('wrong-region', w.file, '', `generated table at ${formatAddr(busOf(w.at))} lies outside the table space explode recorded`);
        else content.set(w.bytes, w.at);
    }
    const image = p.build(content);
    const hash = sha1(image);
    built = p.layout === 'sa1' ? content : image;
    label = p.label;

    // Stage 7: after.
    // The header the manifest describes is the HiROM one (the converters rewrite exhirom's and sa1's).
    checkHeader(manifest, p.layout === 'hirom' ? image : content.slice(0, FOUR_MIB), findings);
    if (seed === null && !changed && p.layout === 'hirom' && p.content === base.image.length && hash !== manifest.base.sha1) {
        findings.error('g0-failed', MANIFEST, '/base/sha1', `nothing changed since explode, yet the ROM's sha1 is ${hash}`);
    }
    const ignored = new Set(findings.list.filter(f => f.rule === 'unknown-file').map(f => f.file));
    const byId = new Map([...ctx.ids].map(([kind, ids]) => {
        const list: (string | null)[] = [];
        for (const [name, id] of ids) list[id] = name;
        return [kind, Array.from(list, n => n ?? null)];
    }));
    // The round trip reads what the game reads: the cartridge, or for sa1 its HiROM content.
    const again = explode(p.layout === 'sa1' ? content : image, manifest.base, game, kinds, byId, manifest.options ?? {});
    const own = (p: string) => p !== MANIFEST && !p.startsWith(BASE_DIR + '/') && !ignored.has(p);
    // Each kind says what of a file counts (Codec.canonical): derived or cached parts are left out of the comparison.
    const strip = (t: Tree): Tree => new Map([...t].filter(([p]) => own(p)).flatMap(([p, b]): [string, Uint8Array][] => {
        const codec = kinds.find(k => p.startsWith(k.path + '/'));
        try { const c = codec?.canonical ? codec.canonical(p, b) : [p, b] as [string, Uint8Array]; return c ? [c] : []; } catch { return [[p, b]]; }
    }));
    const differ = diffTrees(strip(again), strip(tree));
    for (const p of differ.slice(0, 20)) findings.error('round-trip', p, '', again.has(p) ? (tree.has(p) ? 'explodes to different content' : 'explode writes this file; the tree lacks it') : 'explode does not give this file back');
    if (differ.length > 20) findings.error('round-trip', MANIFEST, '', `${differ.length - 20} more files differ`);
    if (changed) findings.info('changed', MANIFEST, '', 'resources changed since explode: G0 not checked; prove with playbacks (G1/G2)');
    if (seed !== null) findings.info('random', MANIFEST, '', `random layout, seed ${seed}: ${layout.moved} of ${items.length} resources moved, built as ${p.label}; prove with playbacks`);
    return done(image, stats, hash);
}
