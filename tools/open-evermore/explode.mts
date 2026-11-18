// Explode: the user's ROM → a folder of named parts (docs/open-evermore/README.md §1).
//   npm run explode -- [rom] [--out out/open-evermore] [--force]
//   (ROM: argument, else the base ROM of the ROM library. The folder is ROM-derived: inside the repository it must
//    be under the git-ignored out/; --force overwrites a folder that already holds a tree.)
// Each kind of evermore/kinds.mts takes its resources in order; `raw` keeps the rest.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import type { Span } from './codec.mts';
import { GAME, KINDS } from './evermore/kinds.mts';
import { FILE as MANIFEST, manifestFor } from './manifest.mts';
import type { Manifest } from './manifest.mts';
import { json, sha1, writeTree } from './tree.mts';
import type { Tree } from './tree.mts';

const require = createRequire(import.meta.url);
export const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
export const TOOL_VERSION: string = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version;

/** The tree of `rom`. `base` is the ROM the tree belongs to: the ROM itself, or (round trip) the original base. */
export function explode(rom: Uint8Array, base: Manifest['base']): Tree {
    const tree: Tree = new Map();
    const claimed: Span[] = [];
    for (const codec of KINDS) {
        const out = codec.explode({ rom, claimed });
        for (const [path, bytes] of out.files) tree.set(path, bytes);
        claimed.push(...out.claims);
    }
    tree.set(MANIFEST, json(manifestFor(rom, GAME, base)));
    return tree;
}

function main(): void {
    const args = process.argv.slice(2);
    const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1] ?? ''; };
    const force = args.includes('--force') && !!args.splice(args.indexOf('--force'), 1);
    const out = resolve(flag('--out') ?? join(REPO, 'out', 'open-evermore'));
    const inRepo = !relative(REPO, out).startsWith('..');
    if (inRepo && relative(join(REPO, 'out'), out).startsWith('..')) {
        console.error(`${out} is inside the repository but not under out/: the tree is ROM-derived and must never be tracked.`);
        process.exit(2);
    }
    if (existsSync(join(out, MANIFEST)) && !force) {
        console.error(`${out} already holds a tree; pass --force to replace it (your edits there are lost).`);
        process.exit(2);
    }

    const { baseRomOrExit } = require('../rom.js');
    const { identifyRom } = require('../../dist/platform');
    const { stripCopierHeader } = require('../../dist/platform/roms/header');
    const path = baseRomOrExit(GAME, args[0]);
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(path)));
    const id = identifyRom(rom);
    const tree = explode(rom, { release: id.variant, sha1: sha1(rom), explodedWith: TOOL_VERSION });

    if (force) for (const kind of KINDS) rmSync(join(out, kind.path), { recursive: true, force: true });
    writeTree(out, tree);
    const bytes = [...tree.values()].reduce((s, b) => s + b.length, 0);
    console.log(`Exploded ${path} (${id.variant}) → ${out}: ${tree.size} files, ${bytes} bytes.`);
    console.log(`Next: npm run implode -- ${relative(process.cwd(), out) || '.'}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
