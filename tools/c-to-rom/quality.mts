// The compile-quality table of the C-built image: per bound routine, the ROM's bytes against the bytes Calypsi placed
// (every section of the routine's object file, from the linker list of the last build), worst ratio first, with the
// G1 verdict of the last G1 run. Written to out/c-to-rom/quality.md (generated, not checked in): the outliers are
// the routines whose C is worth a second look.
//   node tools/c-to-rom/quality.mts [--rom <clean rom>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';
import { stripHeader, hex } from './emu.mts';
import { walk, cdlFor } from './disasm.mts';
import { bindings, sourceFiles, OUT } from './build.mts';

const require = createRequire(import.meta.url);

/** Bytes placed per object file (basename), from the linker's "placed at address a-b of size n" blocks. */
export function placedBytes(lst: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const x of lst.matchAll(/^\S+ in section '[^']+'\n placed at address [0-9a-f]+-[0-9a-f]+ of size ([0-9a-f]+)\n\((.+?\.o) /gm)) {
        const o = basename(x[2]);
        m.set(o, (m.get(o) || 0) + parseInt(x[1], 16));
    }
    return m;
}

/** routine → the "C = ROM" cell of G1.md. */
function g1Verdicts(): Map<string, string> {
    const f = join(OUT, 'G1.md'), m = new Map<string, string>();
    if (!existsSync(f)) return m;
    for (const x of readFileSync(f, 'utf8').matchAll(/^\| `(\w+)` \S+ \| [^|]+\| [^|]+\| ([^|]+)\|/gm)) m.set(x[1], x[2].trim());
    return m;
}

/** Writes the table and returns its path. */
export function writeQuality(romPath: string): string {
    const lstPath = join(OUT, 'obj', 'soe-c.lst');
    if (!existsSync(lstPath)) throw new Error(`no linker list at ${lstPath} (npm run c-to-rom:build)`);
    const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
    const cdl = cdlFor(rom), placed = placedBytes(readFileSync(lstPath, 'utf8')), g1 = g1Verdicts();
    const rows = bindings(sourceFiles()).map(b => {
        const asm = walk(rom, b.addr, cdl).reduce((s, l) => s + l.bytes.length, 0);
        const c = placed.get(`${b.addr.toString(16).toUpperCase()}_${b.name}.o`) ?? null;
        return { ...b, asm, c, ratio: c === null ? -1 : c / Math.max(1, asm) };
    }).sort((x, y) => y.ratio - x.ratio);
    const L = ['# C-built image: bytes per routine', '',
        `ROM bytes: the routine's own instructions (CDL-guided walk). C bytes: every section of its object file in the last build (${basename(lstPath)}). G1: the "C = ROM" column of the last G1 run.`, '',
        '| routine | address | ROM bytes | C bytes | ratio | G1 | file |', '|---|---|---|---|---|---|---|'];
    for (const r of rows)
        L.push(`| \`${r.name}\` | ${hex(r.addr)} | ${r.asm} | ${r.c ?? 'not built'} | ${r.c === null ? '' : r.ratio.toFixed(1) + '×'} | ${g1.get(r.name) || ''} | ${r.file} |`);
    const built = rows.filter(r => r.c !== null);
    const sum = (k: 'asm' | 'c') => built.reduce((s, r) => s + (r[k] || 0), 0);
    if (built.length) L.push('', `${built.length} routine(s) built: ${sum('asm')} ROM bytes → ${sum('c')} C bytes (${(sum('c') / Math.max(1, sum('asm'))).toFixed(1)}×).`);
    const out = join(OUT, 'quality.md');
    writeFileSync(out, L.join('\n') + '\n');
    return out;
}

if (process.argv[1] && process.argv[1].endsWith('quality.mts')) {
    const a = process.argv.slice(2), i = a.indexOf('--rom');
    console.log(writeQuality(require('../rom').baseRomOrExit('evermore', i < 0 ? null : a[i + 1])));
}
