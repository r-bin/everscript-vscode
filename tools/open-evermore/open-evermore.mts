// Open Evermore: one tool, the action is the first argument (docs/open-evermore/tool.md §1). Run `npm run build:ts`
// first: the codecs call the decoders in dist/.
//   node tools/open-evermore/open-evermore.mts explode [rom] [--out out/open-evermore] [--force] [--palettes json|png]
//                                                       [--tiles png|json] [--kinds a,b] [--previews]
//   node tools/open-evermore/open-evermore.mts implode <dir> [--random [seed]] [--check-only] [--strict]
//   node tools/open-evermore/open-evermore.mts prove <dir> [--random [seed] | --stable] [--promoted] [--movies <file|dir>…]
//   node tools/open-evermore/open-evermore.mts locate <rom> [--out out/open-evermore-map]
// explode: the ROM (argument, else the base ROM of the ROM library) → the tree. The tree is ROM-derived: inside the
//          repository only under the git-ignored out/; --force replaces a tree (edits there are lost). --palettes png
//          writes each palette as a 128×8 stripe of its 16 colours instead of JSON; --tiles json writes tiles as
//          rows of hex digits instead of indexed PNGs (both kept in manifest.json). --kinds explodes only those kinds
//          (the rest stays in _base/; implode and prove use the manifest's list): to prove kinds apart. --previews
//          also draws each room as maps/rooms/<map>/preview.png and each ring item's icon as
//          menus/ring_items/<item>.png (for the reader; nothing reads them back).
// implode: the tree → <dir>/_build/evermore.sfc (only without errors), report.md, report.json. --random shuffles
//          where every resource goes (a seed reproduces a layout; without one, a new seed is drawn and printed) and
//          grows the image to 4 MiB, the 4th MB free. --strict keeps every encoding as written (scripts: relative
//          calls between scripts stay relative, so a group of scripts is placed together) and makes warnings errors.
// prove:   build the original (stable) and a random layout from the tree, play the stored playbacks on both, compare
//          every frame (G1). Minutes; on demand. Writes <dir>/_build/prove-<seed>/REPORT.md. The layout is built
//          --strict (lockstep needs vanilla's cycle counts); --promoted builds it as implode does without --strict.
//          --stable: every ROM resource at home, so only the tree's memory changes (moved WRAM) are proved.
// locate:  draft the mapping file of another release (evermore/map-locate.mts): every address of map/us.json found
//          again in <rom> by the US ROM's bytes (the base ROM of the ROM library) → <out>/<release>.draft.json, to
//          check against that release's code before it goes to evermore/map/<release>.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { GAME, loadMap, selectRelease } from './evermore/map.mts';
import { draft, locateAll } from './evermore/map-locate.mts';
import { explode } from './explode.mts';
import { implode } from './implode.mts';
import { prove } from './prove.mts';
import { FILE as MANIFEST } from './manifest.mts';
import { markdown, terminal } from './report.mts';
import { BUILD_DIR, json, readText, readTree, sha1, writeTree } from './tree.mts';

const require = createRequire(import.meta.url);
const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const TOOL_VERSION: string = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).version;
/** The game's kinds, for the release the codecs read: loaded once the release is known (evermore/map.mts). */
type Kinds = typeof import('./evermore/kinds.mts');
let game: Kinds | undefined;
async function load(release: string | null | undefined): Promise<Kinds> {
    selectRelease(release);
    return game ??= await import('./evermore/kinds.mts');
}
/** The release a tree was exploded from (manifest.json `base.release`). */
const treeRelease = (tree: Map<string, Uint8Array>): string | undefined => { try { return JSON.parse(readText(tree.get(MANIFEST)!)).base?.release; } catch { return undefined; } };

const USAGE = 'usage: open-evermore.mts explode [rom] [--out <dir>] [--force] [--palettes json|png] [--tiles png|json] [--kinds a,b] [--previews]\n       open-evermore.mts implode <dir> [--random [seed]] [--check-only] [--strict]\n       open-evermore.mts prove <dir> [--random [seed] | --stable] [--promoted] [--movies <file|dir>…]\n       open-evermore.mts locate <rom> [--out <dir>]';

async function runExplode(args: string[], flag: (n: string) => boolean, value: (n: string) => string | null): Promise<number> {
    const force = flag('--force'), previews = flag('--previews');
    const only = value('--kinds')?.split(',');
    const palettes = value('--palettes'), tiles = value('--tiles');
    if (palettes && palettes !== 'json' && palettes !== 'png') { console.error('--palettes json | png'); return 2; }
    if (tiles && tiles !== 'json' && tiles !== 'png') { console.error('--tiles png | json'); return 2; }
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
    const release: string | null = identifyRom(rom).variant;   // the mapping file to read (null: an unknown ROM, read as us; the codecs refuse what they do not know)
    const { KINDS } = await load(release);
    const unknown = only?.filter(k => !KINDS.some(c => c.kind === k));
    if (unknown?.length) { console.error(`--kinds: no kind ${unknown.join(', ')} (${KINDS.map(c => c.kind).join(', ')})`); return 2; }
    const options: Record<string, Record<string, string>> = {};
    if (palettes && palettes !== 'json') {
        options.palettes = { format: palettes };
        options.sprite_palettes = { format: palettes };
    }
    if (tiles && tiles !== 'png') options.tiles = { format: tiles };
    if (previews) { options.maps = { previews: 'png' }; options.ring_items = { previews: 'png' }; }
    const tree = explode(rom, { release: identifyRom(rom).variant, sha1: sha1(rom), explodedWith: TOOL_VERSION }, GAME, kindsOf(only), undefined, options);
    if (only) { const m = JSON.parse(readText(tree.get(MANIFEST)!)); m.kinds = only; tree.set(MANIFEST, json(m)); }
    // A tree is replaced whole (but its builds): a folder of a kind since renamed or merged (enemies/ into
    // characters/) would stay behind and read as stray files.
    if (force && existsSync(join(out, MANIFEST))) for (const top of readdirSync(out)) if (top !== BUILD_DIR) rmSync(join(out, top), { recursive: true, force: true });
    writeTree(out, tree);
    const bytes = [...tree.values()].reduce((s, b) => s + b.length, 0);
    console.log(`Exploded ${path} → ${out}: ${tree.size} files, ${bytes} bytes.`);
    console.log(`Next: node tools/open-evermore/open-evermore.mts implode ${out} [--random]`);
    return 0;
}

/** The kinds a tree holds: `only` (manifest `kinds`, explode --kinds), else all, in KINDS' order. */
const kindsOf = (only?: string[]) => only ? game!.KINDS.filter(k => only.includes(k.kind)) : game!.KINDS;
const treeKinds = (tree: Map<string, Uint8Array>) => { try { return kindsOf(JSON.parse(readText(tree.get(MANIFEST)!)).kinds); } catch { return game!.KINDS; } };

/** --random [seed]: the seed, a fresh one when none is given, undefined without the flag. */
function takeSeed(args: string[]): number | undefined {
    const r = args.indexOf('--random');
    if (r < 0) return undefined;
    const given = args[r + 1] !== undefined && /^\d+$/.test(args[r + 1]) ? Number(args[r + 1]) : null;
    args.splice(r, given === null ? 1 : 2);
    return given ?? Math.floor(Math.random() * 0xFFFFFFFF);
}

function runLocate(args: string[], value: (n: string) => string | null): number {
    const out = resolve(value('--out') ?? join(REPO, 'out', 'open-evermore-map'));
    if (!args[0]) { console.error(USAGE); return 2; }
    const { baseRomOrExit } = require('../rom.js');
    const { identifyRom } = require('../../dist/platform');
    const { stripCopierHeader } = require('../../dist/platform/roms/header');
    const read = (p: string) => Buffer.from(stripCopierHeader(new Uint8Array(readFileSync(p))));
    const us = read(baseRomOrExit(GAME, undefined)), rom = read(args[0]);
    const id = identifyRom(new Uint8Array(rom));
    if (id.game !== GAME) { console.error(`${args[0]}: not ${GAME}`); return 2; }
    const release: string = id.variant ?? 'unknown';
    const located = locateAll(loadMap('us'), us, rom);
    const count = (h: string) => located.filter(l => l.how === h).length;
    mkdirSync(out, { recursive: true });
    const file = join(out, `${release}.draft.json`);
    writeFileSync(file, JSON.stringify(draft(release, String(id.variant ?? release), located), null, 2) + '\n');
    console.log(`${release}: ${located.length} addresses of us.json — ${count('same')} at the same place, ${count('bytes')} moved (found by their bytes), ${count('around')} moved (found by the code around them), ${count('not-found')} not found, ${count('bank')} banks (not searched).`);
    console.log(`Draft: ${file}`);
    return 0;
}

async function runProve(args: string[], flag: (n: string) => boolean): Promise<number> {
    const strict = !flag('--promoted'), stable = flag('--stable');
    // --stable: the layout keeps every ROM resource at home; only what the tree changed in memory (WRAM) differs.
    const seed = stable ? null : takeSeed(args) ?? Math.floor(Math.random() * 0xFFFFFFFF);
    const m = args.indexOf('--movies');
    const movies = m < 0 ? undefined : args.splice(m).slice(1);
    if (!args[0]) { console.error(USAGE); return 2; }
    const dir = resolve(args[0]);
    const tree = readTree(dir);
    const { PAST_END, POINTER_WINDOWS } = await load(treeRelease(tree));
    const result = await prove(tree, GAME, treeKinds(tree), seed, join(dir, BUILD_DIR, `prove-${seed ?? 'stable'}`), movies, PAST_END, POINTER_WINDOWS, strict);
    if (!result.ok && result.lines.length === 1) console.error(result.lines[0]);
    return result.ok ? 0 : 1;
}

async function runImplode(args: string[], flag: (n: string) => boolean): Promise<number> {
    const checkOnly = flag('--check-only'), strict = flag('--strict');
    const seed = takeSeed(args);
    if (!args[0]) { console.error(USAGE); return 2; }
    const dir = resolve(args[0]);
    const tree = readTree(dir);
    const { PAST_END } = await load(treeRelease(tree));
    const result = implode(tree, GAME, treeKinds(tree), { checkOnly, seed, pastEnd: PAST_END, strict });
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
    process.exitCode = action === 'explode' ? await runExplode(args, flag, value)
        : action === 'implode' ? await runImplode(args, flag)
        : action === 'prove' ? await runProve(args, flag)
        : action === 'locate' ? runLocate(args, value)
        : (console.error(USAGE), 2);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main().catch((e: Error) => { console.error(e.message); process.exitCode = 2; });
