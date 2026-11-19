// One codec per resource kind (docs/open-evermore/tool.md §4).
// Hard rule (README.md §1): every exploded resource is reached only through what implode generates (tables,
// pointers), never through a fixed address. So a codec gives implode *items* to place anywhere their rule allows,
// and writes the tables that point at wherever they landed. What no kind owns stays in `_base/`, pinned.
import type { Base } from './base.mts';
import type { Findings } from './findings.mts';
import type { Manifest } from './manifest.mts';
import type { Tree } from './tree.mts';

/** Names any exploded resource by kind and id. */
export type NameOf = (kind: string, id: number) => string;

/** A file-offset range, end exclusive. */
export interface Span { start: number; end: number }

/** Where an item may go (manifest.md §1.4). */
export interface Rule {
    /** Only $xx:8000-$FFFF (the 32 KiB upper half of a bank). */
    upperHalf?: boolean;
    /** Never across a 64 KiB bank boundary. */
    noCrossBank?: boolean;
    maxSize?: number;
}

/** One placeable resource: `key` is `<kind>/<name>`. */
export interface Item { key: string; file: string; bytes: Uint8Array; rule: Rule }

export interface Exploded {
    files: Tree;
    /** Bytes the kind's resources occupied: implode may place any item there. */
    pool: Span[];
    /** Bytes implode generates (tables that point at items). */
    tables: Span[];
    /** Where each item was, and its bytes' sha1: the stable layout, and how implode tells what changed. */
    homes: { key: string; at: number; length: number; sha1: string }[];
}

export interface ImplodeContext {
    tree: Tree;
    manifest: Manifest;
    size: number;
    base: Base;
    findings: Findings;
    /** Ids by name, per kind, from each folder's _enum.json (enum.mts); set before encode. */
    ids: Map<string, Map<string, number>>;
    /**
     * What one kind requires of another kind's resources, by `<kind>/<name>` (`mark`): the maps kind marks every
     * tile a room uses `used`, and every animation frame `dma` (streamed raw). Filled by encode, in kind order.
     */
    marks: Map<string, Set<string>>;
    /** The 24-bit address the game uses for content offset `at`, in the layout being built (layouts.mts). */
    pointer(at: number): number;
}

/** Records that `key` (`<kind>/<name>`) is required to be `what`. */
export function mark(ctx: ImplodeContext, key: string, what: string): void {
    let s = ctx.marks.get(key);
    if (!s) ctx.marks.set(key, s = new Set());
    s.add(what);
}

/** Bytes for the image at a file offset, and the tree file they came from (for findings). */
export interface Write { at: number; bytes: Uint8Array; file: string }

export interface Codec {
    kind: string;
    version: number;
    /** The top-level folder of the tree this kind owns. */
    path: string;
    /** The name explode gives resource `id` when nothing else names it (the repo's own names, or kind + id). */
    defaultName(id: number): string;
    /**
     * `name(kind, id)`: the name of any kind's resource, for this kind's files and its references to other kinds
     * (the tree's own enums on a round trip, else each kind's defaultName).
     */
    explode(rom: Uint8Array, name: NameOf, options: Record<string, string>): Exploded;
    /**
     * What of a file the round trip compares, as [path, bytes], when not all of it is the resource: a tile's indices
     * whether PNG or JSON (a PNG's palette only shows it), a JSON file without what explode derives (which maps use a
     * family) or caches (vanilla packed bytes). The path may drop the file format, so either form compares equal.
     * Null: a file only for the reader (a map's preview.png), left out.
     */
    canonical?(path: string, bytes: Uint8Array): [string, Uint8Array] | null;
    /** The names of the resources in the tree (folder or file names, unordered); stray files are warnings. */
    names(ctx: ImplodeContext): Set<string>;
    /** Reads, validates and encodes the resources; findings go to ctx.findings. */
    encode(ctx: ImplodeContext, names: Set<string>): Item[];
    /** The generated tables, given each name's id (ctx.ids) and where every item landed (file offsets by key). */
    tables(ctx: ImplodeContext, placed: Map<string, number>): Write[];
}
