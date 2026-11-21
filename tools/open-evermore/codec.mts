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
/** On a round trip, the tree's name for what lies at a file offset; undefined when exploding a ROM afresh. */
export type NameAt = (kind: string, at: number) => string | undefined;
/** How many ids a kind's enum holds on a round trip; undefined when exploding a ROM afresh. */
export type CountOf = (kind: string) => number | undefined;

/** A file-offset range, end exclusive. */
export interface Span { start: number; end: number }

/** Where an item may go (manifest.md §1.4). */
export interface Rule {
    /** Only $xx:8000-$FFFF (the 32 KiB upper half of a bank). */
    upperHalf?: boolean;
    /** Starts in $xx:0000-$7FFF (a pointer of 15 bits, like a string key's). */
    lowerHalf?: boolean;
    /** Ends below this file offset (a pointer that only reaches the first 4 MB). */
    below?: number;
    /** Starts at or after this file offset (a pointer counted from a base: a sprite block's bank $D9 + 7 bits). */
    above?: number;
    /** Starts at this 16-bit offset in its bank (records the game keeps by their 16-bit address: only the bank
     *  moves). */
    bankOffset?: number;
    /** Never across a 64 KiB bank boundary. */
    noCrossBank?: boolean;
    /** Never ending on a bank's last byte: a reader that steps on after its last byte (`iny` / `bne`) turns the bank
     *  there, which costs cycles vanilla never spent (music: docs/open-evermore/progress.md §2). */
    noBankEnd?: boolean;
    maxSize?: number;
    /**
     * The item lives in a window: the upper halves of file banks `from` up to (not including) `to`, read as one
     * space (a reader that steps from $xx:FFFF on to $xx+1:8000). It may run on into the next bank's upper half;
     * its bytes are then written in pieces (layout.mts `windowPieces`).
     */
    window?: Window;
}

/** File banks whose upper halves a reader sees as one contiguous space. */
export interface Window { from: number; to: number }

/**
 * One placeable resource: `key` is `<kind>/<name>`. A `generated` item is a table that points at other items (a
 * grown map table): encode gives its size, `tables` writes its bytes where it landed; it is not a resource of its
 * own, so it never counts as changed.
 */
export interface Item {
    key: string; file: string; bytes: Uint8Array; rule: Rule; generated?: boolean;
    /** Its kind's `tables` writes into it after placement (absolute references to other items); `bytes` hold
     *  those operands as 0, and so does the sha1 explode recorded for its home. */
    patched?: boolean;
    /**
     * Byte ranges (offsets in `bytes`, sorted) that are not the item's: it keeps its shape around them, but they stay
     * free for others (scripts that call each other across another kind's data). `bytes` holds 0 there.
     */
    holes?: Span[];
    /** Its resource is unchanged since explode although its bytes differ: the same content in another encoding (a
     *  script whose relative calls became absolute ones). */
    same?: boolean;
    /**
     * Which bytes are which resource's, for the proof: each stretch `[dst, dst + length)` of `bytes` is the stretch from
     * `src` of resource `key` in its encoding as written (a command written longer splits a script into stretches,
     * and a group of scripts holds several). Absent: the whole item is resource `key` from offset 0.
     */
    segments?: Segment[];
}

export interface Segment { key: string; src: number; dst: number; length: number }

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
    /** Every kind's resource names (as `names` gave them); set before encode. */
    names: Map<string, Set<string>>;
    /**
     * Named addresses inside items, `<kind>/<name>` → file offset, from each kind's `symbols` once every item is
     * placed (a script inside a group of scripts); set before `tables`.
     */
    symbols: Map<string, number>;
    /** A random layout is being built (implode `seed`). */
    random: boolean;
    /** Keep every encoding as written (`--strict`): a kind may not choose a longer form so an item can go anywhere. */
    strict: boolean;
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
    /** Only the names `_enum.json` lists get an id; the others are reached by name alone (scripts). */
    listedIdsOnly?: boolean;
    /** What a name of this kind may look like, when not NAME_RE (scripts: `<map>/<local>`). */
    nameRe?: RegExp;
    /** The name explode gives resource `id` when nothing else names it (the repo's own names, or kind + id). */
    defaultName(id: number): string;
    /**
     * `name(kind, id)`: the name of any kind's resource, for this kind's files and its references to other kinds
     * (the tree's own enums on a round trip, else each kind's defaultName). `count(kind)`: how many ids the tree's
     * enum of a kind holds, on a round trip (a table that can grow does not tell its length); undefined otherwise.
     * `nameAt(kind, at)`: on a round trip, the name the tree gave the resource that implode put at file offset `at`
     * (resources no enum orders, such as scripts reached only from other scripts).
     */
    explode(rom: Uint8Array, name: NameOf, options: Record<string, string>, count: CountOf, nameAt: NameAt): Exploded;
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
    /** Named addresses inside this kind's items, once they are placed (ImplodeContext.symbols). */
    symbols?(ctx: ImplodeContext, placed: Map<string, number>): Map<string, number>;
    /** The generated tables, given each name's id (ctx.ids) and where every item landed (file offsets by key): in the
     *  table space explode recorded, or in a `generated` or `patched` item of this build. */
    tables(ctx: ImplodeContext, placed: Map<string, number>): Write[];
}
