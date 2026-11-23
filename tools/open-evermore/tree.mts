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
/**
 * JSON as the tree stores it: indented, but compact where a file holds many small things (owner, 2026-11-19): an
 * array of numbers (a grid row) is one line; an object, or an array of plain values, that fits in LINE characters is
 * one line (a trigger, a frame, a metatile); a list of objects is one per line. The rest is one item per line.
 * `line`: a wider limit for a file of long entries that reads best one per line (metatiles.json).
 */
export const json = (value: unknown, line = LINE): Uint8Array => text(format(value, '', line) + '\n');
const LINE = 120;
const MULTILINE_KEYS = new Set(['art', 'shape']);
function format(v: unknown, indent: string, line: number, multiline = false): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    const inline = (x: unknown): string => x === null || typeof x !== 'object' ? JSON.stringify(x)
        : Array.isArray(x) ? `[${x.map(inline).join(', ')}]`
        : `{ ${Object.entries(x).filter(([, e]) => e !== undefined).map(([k, e]) => `${JSON.stringify(k)}: ${inline(e)}`).join(', ')} }`;
    const one = inline(v);
    if (Array.isArray(v) && v.every(e => typeof e === 'number')) return one;
    const hasMultiline = !Array.isArray(v) && Object.entries(v).some(([k, e]) => MULTILINE_KEYS.has(k) && Array.isArray(e));
    const flat = !multiline && !hasMultiline && (Array.isArray(v) ? v.every(e => e === null || typeof e !== 'object') : true);
    if (flat && indent.length + one.length <= line) return one;
    const inner = indent + '  ';
    if (Array.isArray(v)) return v.length ? `[\n${v.map(e => inner + format(e, inner, line)).join(',\n')}\n${indent}]` : '[]';
    const entries = Object.entries(v).filter(([, e]) => e !== undefined);
    return entries.length ? `{\n${entries.map(([k, e]) => `${inner}${JSON.stringify(k)}: ${format(e, inner, line, MULTILINE_KEYS.has(k))}`).join(',\n')}\n${indent}}` : '{}';
}
export const readText = (bytes: Uint8Array): string => decoder.decode(bytes);

/** A JSON file without the given keys, at any depth (for Codec.canonical); other files unchanged. */
export function withoutKeys(path: string, bytes: Uint8Array, keys: string[]): Uint8Array {
    if (!path.endsWith('.json')) return bytes;
    const drop = (v: any): void => { if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (keys.includes(k)) delete v[k]; else drop(v[k]); } };
    const v = JSON.parse(readText(bytes));
    drop(v);
    return json(v);
}

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
