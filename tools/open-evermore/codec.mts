// One codec per resource kind (docs/open-evermore/tool.md §4). Explode runs the kinds in order, each claiming the
// ROM bytes it now owns; `raw` runs last and keeps the rest. Implode asks every kind for the bytes it writes.
import type { Findings } from './findings.mts';
import type { Manifest } from './manifest.mts';
import type { Tree } from './tree.mts';

/** A file-offset range, end exclusive. */
export interface Span { start: number; end: number }

export interface ExplodeContext {
    rom: Uint8Array;
    /** Ranges earlier kinds took. */
    claimed: Span[];
}

export interface Exploded {
    /** Files of this kind, by path inside the tree. */
    files: Tree;
    claims: Span[];
}

export interface ImplodeContext {
    tree: Tree;
    manifest: Manifest;
    size: number;
    findings: Findings;
}

/** Bytes for the image at a file offset, and the tree file they came from (for findings). */
export interface Write { at: number; bytes: Uint8Array; file: string }

export interface Imploded {
    writes: Write[];
    /** True when a resource differs from what explode wrote; G0 is checked only when no kind changed. */
    changed: boolean;
}

export interface Codec {
    kind: string;
    version: number;
    /** The top-level folder (or file) of the tree this kind owns. */
    path: string;
    explode(ctx: ExplodeContext): Exploded;
    implode(ctx: ImplodeContext): Imploded;
}
