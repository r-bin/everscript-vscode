// `_base/`: the part of the ROM no kind has exploded yet (docs/open-evermore/README.md §3). Not a resource: one
// pinned image with the kinds' pool and generated tables blanked, and `_base.json` saying which bytes those are.
// Implode starts from it, so editing it is an error (`base-changed`). Each kind that is exploded makes it emptier.
import type { Exploded, Span } from './codec.mts';
import type { Findings } from './findings.mts';
import { busOf, fileOf, formatAddr, parseAddr } from './manifest.mts';
import { normalise } from './layout.mts';
import { json, readText, sha1 } from './tree.mts';
import type { Tree } from './tree.mts';

export const DIR = '_base', IMAGE = '_base/unexploded.bin', INDEX = '_base/_base.json';
export const FILL = 0xFF;

interface Range { from: string; to: string; kind: string }
interface BaseIndex {
    sha1: string;
    fill: string;
    pool: Range[];
    tables: Range[];
    homes: Record<string, { at: string; length: number; sha1: string }>;
    /** sha1 of each kind's _enum.json as explode wrote it: a reordered enum is a change too. */
    enums: Record<string, string>;
}

export interface Base {
    image: Uint8Array;
    pool: Span[];
    /** Generated table space, by the kind that writes it. */
    tables: (Span & { kind: string })[];
    /** Where each resource was, and how long it was there. */
    homes: Map<string, Home>;
    homeSha1: Map<string, string>;
    enumSha1: Map<string, string>;
}

export interface Home { at: number; length: number }

const range = (s: Span, kind: string): Range => ({ from: formatAddr(busOf(s.start)), to: formatAddr(busOf(s.end - 1)), kind });

/** The `_base/` files for `rom` once every kind took its part. */
export function baseFiles(rom: Uint8Array, kinds: { kind: string; out: Exploded }[]): Tree {
    const image = rom.slice();
    const index: BaseIndex = { sha1: '', fill: '$' + FILL.toString(16).toUpperCase(), pool: [], tables: [], homes: {}, enums: {} };
    for (const { kind, out } of kinds) {
        for (const s of normalise(out.pool)) { image.fill(FILL, s.start, s.end); index.pool.push(range(s, kind)); }
        for (const s of normalise(out.tables)) { image.fill(FILL, s.start, s.end); index.tables.push(range(s, kind)); }
        for (const [path, bytes] of out.files) if (path.endsWith('/_enum.json')) index.enums[path] = sha1(bytes);
        for (const h of out.homes) index.homes[h.key] = { at: formatAddr(busOf(h.at)), length: h.length, sha1: h.sha1 };
    }
    index.sha1 = sha1(image);
    return new Map([[IMAGE, image], [INDEX, json(index)]]);
}

export function readBase(tree: Tree, size: number, f: Findings): Base | null {
    const raw = tree.get(INDEX), image = tree.get(IMAGE);
    if (!raw) f.error('missing-file', INDEX, '', 'the base index is missing');
    if (!image) f.error('missing-file', IMAGE, '', 'the unexploded part of the ROM is missing');
    if (!raw || !image) return null;
    let index: BaseIndex;
    try { index = JSON.parse(readText(raw)); }
    catch (e) { f.error('parse-error', INDEX, '', (e as Error).message); return null; }
    if (sha1(image) !== index.sha1) { f.error('base-changed', IMAGE, '', 'the unexploded part was edited; change a resource through its kind instead'); return null; }
    if (image.length !== size) { f.error('size-mismatch', IMAGE, '', `${image.length} bytes, but manifest.json says ${size}`); return null; }
    const spans = (list: Range[], key: string): (Span & { kind: string })[] => (list ?? []).map((r, i) => {
        const from = parseAddr(r.from), to = parseAddr(r.to);
        if (from === null || to === null) { f.error('schema', INDEX, `/${key}/${i}`, 'from/to as "$BBAAAA"'); return { start: 0, end: 0, kind: r.kind }; }
        return { start: fileOf(from), end: fileOf(to) + 1, kind: r.kind };
    });
    const homes = new Map<string, Home>(), homeSha1 = new Map<string, string>();
    for (const [key, h] of Object.entries(index.homes ?? {})) {
        const at = parseAddr(h.at);
        if (at === null || !Number.isInteger(h.length)) { f.error('schema', INDEX, `/homes/${key}`, 'at as "$BBAAAA" and a length'); continue; }
        homes.set(key, { at: fileOf(at), length: h.length }); homeSha1.set(key, h.sha1);
    }
    return { image, pool: spans(index.pool, 'pool'), tables: spans(index.tables, 'tables'), homes, homeSha1, enumSha1: new Map(Object.entries(index.enums ?? {})) };
}
