// Where each kind lives in the tree (docs/open-evermore/README.md §3). A codec reads and writes paths under its own
// kind's name (`tiles/tile_0000.png`, item keys `tiles/_table`); a kind may live inside another's folder
// (`Codec.folder`: maps/tiles/, characters/behaviours/), so related kinds sit together. Explode moves the codecs' paths
// into the folders, implode moves them back, and findings name the files as they are on disk.
import type { Codec } from './codec.mts';
import type { Tree } from './tree.mts';

export interface Folders {
    /** A codec's path → where it is in the tree. */
    toTree(path: string): string;
    /** A path in the tree → the codec's (the deepest folder that holds it decides). */
    fromTree(path: string): string;
}

export function folders(kinds: Codec[]): Folders {
    const moved = kinds.filter(k => k.folder && k.folder !== k.path).map(k => ({ kind: k.path + '/', folder: k.folder + '/' }))
        .sort((a, b) => b.folder.length - a.folder.length);
    const fromTree = (p: string) => { const m = moved.find(x => p.startsWith(x.folder)); return m ? m.kind + p.slice(m.folder.length) : p; };
    return {
        fromTree,
        toTree(p) {
            const m = moved.find(x => p.startsWith(x.kind)), out = m ? m.folder + p.slice(m.kind.length) : p;
            // A resource named like a folder another kind lives in (a character named `behaviours`) would read back as that kind's.
            if (fromTree(out) !== p) throw new Error(`${p}: its name is the folder ${out.split('/').slice(0, 2).join('/')}/ of another kind; rename it`);
            return out;
        },
    };
}

/** Every path of `tree` through `map`. */
export const mapTree = (tree: Tree, map: (path: string) => string): Tree => new Map([...tree].map(([p, b]) => [map(p), b]));
