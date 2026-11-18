// Explode: the user's ROM → a folder of named resources (docs/open-evermore/README.md §1). Each kind takes its
// resources, the pool of bytes they occupied and the tables that point at them; `_base/` keeps the rest, pinned.
// CLI: open-evermore.mts.
import type { Codec, Exploded } from './codec.mts';
import { baseFiles } from './base.mts';
import { CHECKSUM, FILE as MANIFEST, manifestFor } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { json } from './tree.mts';
import type { Tree } from './tree.mts';

/** The tree of `rom`. `base` names the ROM the tree belongs to (the ROM itself, or the original on a round trip). */
export function explode(rom: Uint8Array, base: Manifest['base'], game: string, kinds: Codec[], names?: Map<string, (string | null)[]>): Tree {
    const tree: Tree = new Map();
    const parts: { kind: string; out: Exploded }[] = [];
    for (const codec of kinds) {
        const out = codec.explode(rom, names?.get(codec.kind));
        for (const [path, bytes] of out.files) tree.set(path, bytes);
        parts.push({ kind: codec.kind, out });
    }
    // The header checksum is generated over whatever implode builds.
    parts.push({ kind: 'checksum', out: { files: new Map(), pool: [], tables: [CHECKSUM], homes: [] } });
    for (const [path, bytes] of baseFiles(rom, parts)) tree.set(path, bytes);
    tree.set(MANIFEST, json(manifestFor(rom, game, base)));
    return tree;
}
