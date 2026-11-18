// The folder as data: a map from a path inside the tree ('raw/bank_c0.bin') to its bytes. Explode builds one in
// memory and writes it; implode reads one from disk; the round trip compares two (docs/open-evermore/README.md §3).
// Paths use '/', never start with '/', and skip `_build/` (implode's output, not part of the tree).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Tree = Map<string, Uint8Array>;

export const BUILD_DIR = '_build';

/** Resource names: snake case, at most 80 characters, so they also work as Asar labels (README.md §4). */
export const NAME_RE = /^[a-z][a-z0-9_]{0,79}$/;

export const sha1 = (bytes: Uint8Array): string => createHash('sha1').update(bytes).digest('hex');

const encoder = new TextEncoder(), decoder = new TextDecoder();
export const text = (s: string): Uint8Array => encoder.encode(s);
export const json = (value: unknown): Uint8Array => text(JSON.stringify(value, null, 2) + '\n');
export const readText = (bytes: Uint8Array): string => decoder.decode(bytes);

export function readTree(dir: string): Tree {
    const tree: Tree = new Map();
    const walk = (rel: string) => {
        for (const name of readdirSync(join(dir, rel)).sort()) {
            const path = rel ? rel + '/' + name : name;
            if (path === BUILD_DIR || name.startsWith('.')) continue;
            if (statSync(join(dir, path)).isDirectory()) walk(path);
            else tree.set(path, new Uint8Array(readFileSync(join(dir, path))));
        }
    };
    walk('');
    return tree;
}

export function writeTree(dir: string, tree: Tree): void {
    for (const [path, bytes] of tree) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), bytes);
    }
}

/** Paths whose bytes differ, or that only one side has; sorted. */
export function diffTrees(a: Tree, b: Tree): string[] {
    const paths = new Set([...a.keys(), ...b.keys()]);
    return [...paths].filter(p => {
        const x = a.get(p), y = b.get(p);
        return !x || !y || x.length !== y.length || sha1(x) !== sha1(y);
    }).sort();
}
