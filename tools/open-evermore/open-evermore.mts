// Open Evermore: one tool, the action is the first argument (docs/open-evermore/tool.md §1). Run `npm run build:ts`
// first: the codecs call the decoders in dist/.
//   node tools/open-evermore/open-evermore.mts explode [rom] [--out out/open-evermore] [--force] [--families json|png]
//   node tools/open-evermore/open-evermore.mts implode <dir> [--random [seed]] [--check-only] [--strict]
//   node tools/open-evermore/open-evermore.mts prove <dir> [--random [seed]] [--movies <file|dir>…]
// explode: the ROM (argument, else the base ROM of the ROM library) → the tree. The tree is ROM-derived: inside the
//          repository only under the git-ignored out/; --force replaces a tree (edits there are lost). --families png
//          writes each tile family as a 128×8 stripe of its 16 colours instead of JSON (kept in manifest.json).
// implode: the tree → <dir>/_build/evermore.sfc (only without errors), report.md, report.json. --random shuffles
//          where every resource goes (a seed reproduces a layout; without one, a new seed is drawn and printed) and
//          grows the image to 4 MiB, the 4th MB free.
// prove:   build the original (stable) and a random layout from the tree, play the stored playbacks on both, compare
//          every frame (G1). Minutes; on demand. Writes <dir>/_build/prove-<seed>/REPORT.md.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { DIR as BASE_DIR } from './base.mts';
import { GAME, KINDS } from './evermore/kinds.mts';
import { explode } from './explode.mts';
import { implode } from './implode.mts';
import { prove } from './prove.mts';
import { FILE as MANIFEST } from './manifest.mts';
import { markdown, terminal } from './report.mts';
import { BUILD_DIR, readTree, sha1, writeTree } from './tree.mts';

const require = createRequire(import.meta.url);
const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const TOOL_VERSION: string = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version;
const USAGE = 'usage: open-evermore.mts explode [rom] [--out <dir>] [--force] [--families json|png]\n       open-evermore.mts implode <dir> [--random [seed]] [--check-only] [--strict]\n       open-evermore.mts prove <dir> [--random [seed]] [--movies <file|dir>…]';

function runExplode(args: string[], flag: (n: string) => boolean, value: (n: string) => string | null): number {
    const force = flag('--force');
    const families = value('--families');
    if (families && families !== 'json' && families !== 'png') { console.error('--families json | png'); return 2; }
    const out = resolve(value('--out') ?? join(REPO, 'out', 'open-evermore'));
    if (!relative(REPO, out).startsWith('..') && relative(join(REPO, 'out'), out).startsWith('..')) {
        console.error(`${out} is inside the repository but not under out/: the tree is ROM-derived and must never be tracked.`);
        return 2;
    }
    if (existsSync(join(out, MANIFEST)) && !force) {
        console.error(`${out} already holds a tree; pass --force to replace it (your edits there are lost).`);
        return 2;
    }
    const { baseRomOrExit } = require('../rom.js');
    const { identifyRom } = require('../../dist/platform');
    const { stripCopierHeader } = require('../../dist/platform/roms/header');
    const path = baseRomOrExit(GAME, args[0]);
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(path)));
    const options = families && families !== 'json' ? { tile_families: { format: families } } : {};
    const tree = explode(rom, { release: identifyRom(rom).variant, sha1: sha1(rom), explodedWith: TOOL_VERSION }, GAME, KINDS, undefined, options);
    if (force) for (const top of [BASE_DIR, ...KINDS.map(k => k.path)]) rmSync(join(out, top), { recursive: true, force: true });
    writeTree(out, tree);
    const bytes = [...tree.values()].reduce((s, b) => s + b.length, 0);
    console.log(`Exploded ${path} → ${out}: ${tree.size} files, ${bytes} bytes.`);
    console.log(`Next: node tools/open-evermore/open-evermore.mts implode ${relative(process.cwd(), out) || '.'} [--random]`);
    return 0;
}

/** --random [seed]: the seed, a fresh one when none is given, undefined without the flag. */
function takeSeed(args: string[]): number | undefined {
    const r = args.indexOf('--random');
    if (r < 0) return undefined;
    const given = args[r + 1] !== undefined && /^\d+$/.test(args[r + 1]) ? Number(args[r + 1]) : null;
    args.splice(r, given === null ? 1 : 2);
    return given ?? Math.floor(Math.random() * 0xFFFFFFFF);
}

async function runProve(args: string[]): Promise<number> {
    const seed = takeSeed(args) ?? Math.floor(Math.random() * 0xFFFFFFFF);
    const m = args.indexOf('--movies');
    const movies = m < 0 ? undefined : args.splice(m).slice(1);
    if (!args[0]) { console.error(USAGE); return 2; }
    const dir = resolve(args[0]);
    const result = await prove(readTree(dir), GAME, KINDS, seed, join(dir, BUILD_DIR, `prove-${seed}`), movies);
    if (!result.ok && result.lines.length === 1) console.error(result.lines[0]);
    return result.ok ? 0 : 1;
}

function runImplode(args: string[], flag: (n: string) => boolean): number {
    const checkOnly = flag('--check-only'), strict = flag('--strict');
    const seed = takeSeed(args);
    if (!args[0]) { console.error(USAGE); return 2; }
    const dir = resolve(args[0]);
    const result = implode(readTree(dir), GAME, KINDS, { checkOnly, seed });
    if (strict) for (const f of result.findings.list) if (f.severity === 'warning') f.severity = 'error';
    const failed = result.findings.failed;

    const build = join(dir, BUILD_DIR);
    rmSync(join(build, 'evermore.sfc'), { force: true });
    mkdirSync(build, { recursive: true });
    if (result.image && !failed) writeFileSync(join(build, 'evermore.sfc'), result.image);
    writeFileSync(join(build, 'report.json'), JSON.stringify({ sha1: result.sha1, seed: result.seed, stats: result.stats, findings: result.findings.list }, null, 2) + '\n');
    writeFileSync(join(build, 'report.md'), markdown(dir, result));
    console.log(terminal(dir, result, checkOnly));
    return failed ? 1 : 0;
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const flag = (name: string) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
    const value = (name: string) => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1] ?? null; };
    const action = args.shift();
    process.exitCode = action === 'explode' ? runExplode(args, flag, value)
        : action === 'implode' ? runImplode(args, flag)
        : action === 'prove' ? await runProve(args)
        : (console.error(USAGE), 2);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
