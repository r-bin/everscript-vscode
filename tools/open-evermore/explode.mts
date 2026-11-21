// Explode: the user's ROM → a folder of named resources (docs/open-evermore/README.md §1). Each kind takes its
// resources, the pool of bytes they occupied and the tables that point at them; `_base/` keeps the rest, pinned.
// CLI: open-evermore.mts.
import type { Codec, Exploded } from './codec.mts';
import { baseFiles } from './base.mts';
import { folders, mapTree } from './folders.mts';
import { CHECKSUM, FILE as MANIFEST, manifestFor } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { json } from './tree.mts';
import type { Tree } from './tree.mts';

/** The tree of `rom`. `base` names the ROM the tree belongs to (the ROM itself, or the original on a round trip). */
/** `located`: on a round trip, `<kind>/<name>` → the file offset implode put it at (Codec.explode `nameAt`). */
export function explode(rom: Uint8Array, base: Manifest['base'], game: string, kinds: Codec[], names?: Map<string, (string | null)[]>, options: Manifest['options'] = {}, located?: Map<string, number>): Tree {
    const at = new Map<string, string>();
    for (const [key, offset] of located ?? []) at.set(`${key.slice(0, key.indexOf('/'))}@${offset}`, key.slice(key.indexOf('/') + 1));
    const byKind = new Map(kinds.map(k => [k.kind, k]));
    const name = (kind: string, id: number): string => names?.get(kind)?.[id] ?? byKind.get(kind)?.defaultName(id) ?? `${kind}_${id.toString(16)}`;
    const tree: Tree = new Map();
    const parts: { kind: string; out: Exploded }[] = [];
    for (const codec of kinds) {
        const out = codec.explode(rom, name, options[codec.kind] ?? {}, kind => names?.get(kind)?.length, (kind, offset) => at.get(`${kind}@${offset}`));
        for (const [path, bytes] of out.files) tree.set(path, bytes);
        parts.push({ kind: codec.kind, out });
    }
    // The header checksum is generated over whatever implode builds.
    parts.push({ kind: 'checksum', out: { files: new Map(), pool: [], tables: [CHECKSUM], homes: [] } });
    for (const [path, bytes] of baseFiles(rom, parts)) tree.set(path, bytes);
    const manifest = manifestFor(rom, game, base);
    if (Object.keys(options).length) manifest.options = options;
    tree.set(MANIFEST, json(manifest));
    // Each kind's files in its folder (folders.mts).
    return mapTree(tree, folders(kinds).toTree);
}
