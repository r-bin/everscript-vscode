// Convert the clean 3 MB HiROM Secret of Evermore ROM into an 8 MB SA-1 image that plays like the original with the
// SA-1 CPU held in reset: the S-CPU does everything, cycle for cycle (docs/sa1/port.md).
//   npm run sa1 -- [clean rom] [out.sfc] [--fill ff|db] [--upper hardware|mesen|snes9x2005|fill] [--listing]
//   (ROM: argument, else the base ROM of the ROM library; output: out/soe-sa1.sfc; --listing prints the boot block)
// The steps, each in its own file:
//   1. layout.mts   both ROM views: the LoROM copy for code in $80-$BF, the linear copy for data in $C0-$FF
//   2. header.mts   bank $00: SA-1 header, vectors, vector entries
//   3. boot.mts     the boot block that sets the SA-1 bank registers at power-on, at no cost in time
//   4. here         the checksum, and checks that MesenCE will map it as SA-1
// Everything is read from the user's ROM; the repo holds no game bytes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { MB, IMAGE_SIZE, LINEAR, BANK_VALUES, loRomFile, writeViews } from './layout.mts';
import { writeBankZero, bankZeroUsed, finishChecksum, assertMesenPicksBlockZero, SA1_MAP_MODE, SA1_CART_TYPE, type VectorEntry } from './header.mts';
import { bootBlock, listing, BOOT, COLD, REFRESH_FIT, type BootBlock } from './boot.mts';
import { JML } from './asm.mts';

const require = createRequire(import.meta.url);
const { hardwareMirror } = require('../exhirom/convert.js');
const { markDerived } = require('../derived-marker');

export const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
export { LINEAR };

export type Upper = 'hardware' | 'mesen' | 'snes9x2005' | 'fill';
// What the HiROM 4th MB (file 0x300000-0x3FFFFF, never ROM of its own) answered. The game reads it once, at
// $80:D113 (knowledge/routines/row_table_low_bytes_from_bank_b0.md), so the image must answer the same there:
//   hardware    the original cartridge (2 MB + 1 MB chips: 0x300000+ shows 0x200000+); the default
//   mesen       MesenCE, which maps every 4 KB page of the 4th MB to page 0x200000 (BaseCartridge::Init); for the proof
//   snes9x2005  the bundled core (offset % size)
//   fill        the fill byte (trap image)
const UPPER: Record<Exclude<Upper, 'fill'>, (rom: Uint8Array, off: number) => number> = {
    hardware: (rom, off) => rom[hardwareMirror(off, rom.length)],
    mesen: (rom, off) => rom[0x200000 + (off & 0xFFF)],
    snes9x2005: (rom, off) => rom[off % rom.length],
};

export interface Options {
    fill?: number;
    upper?: Upper;
    /** Overrides boot.mts REFRESH_FIT (sa1:measure tries values). */
    refreshFit?: number;
    /** Writes extra bytes (the derived-ROM marker) before the checksum. */
    mark?: (image: Uint8Array) => void;
}

export interface Report {
    fill: number; upper: Upper; checksum: number;
    boot: BootBlock & { at: number };
    /** Bytes of the LoROM views that differ from HiROM on purpose: the jump at $80:802D and the boot block. */
    patched: [number, number][];
    entries: VectorEntry[];
    scores: Record<string, number>;
}

/** Ranges of the image written on purpose; everything else is fill. */
export function usedRanges(r: Report): [number, number][] {
    return [...bankZeroUsed(r.entries), [2 * MB, 4 * MB], [LINEAR, LINEAR + 4 * MB]];
}

export function convert(source: Uint8Array, opts: Options = {}): { image: Uint8Array; report: Report } {
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const fill = opts.fill ?? 0xFF, upper = opts.upper ?? 'hardware';
    if (rom.length > 4 * MB || rom.length < 0x10000) throw new Error(`expected a HiROM image of 64 KB-4 MB, got ${rom.length} bytes`);
    if ((rom[0xFFD5] & ~0x10) !== 0x21) throw new Error(`map mode $${rom[0xFFD5].toString(16)} at $FFD5 is not HiROM`);
    if (upper !== 'fill' && !UPPER[upper]) throw new Error(`unknown upper mode ${upper}`);
    const hirom = (off: number) => off < rom.length ? rom[off] : upper === 'fill' ? fill : UPPER[upper](rom, off);

    const image = new Uint8Array(IMAGE_SIZE).fill(fill);
    writeViews(image, hirom);                                         // 1. blocks 2-7
    const entries = writeBankZero(image, rom);                       // 2. block 0
    const boot = { at: BOOT, ...bootBlock(rom, opts.refreshFit) };   // 3. boot block + the jump to it
    const bootFile = loRomFile(BOOT), jumpFile = loRomFile(COLD), jump = JML(BOOT).bytes;
    image.set(boot.bytes, bootFile);
    image.set(jump, jumpFile);
    const patched: [number, number][] = [[jumpFile, jumpFile + jump.length], [bootFile, bootFile + boot.bytes.length]];
    if (opts.mark) opts.mark(image);
    const sum = finishChecksum(image);                                // 4.
    const scores = assertMesenPicksBlockZero(image);
    return { image, report: { fill, upper, checksum: sum, boot, patched, entries, scores } };
}

function main(): void {
    const args = process.argv.slice(2);
    const take = (flag: string) => { const i = args.indexOf(flag); return i < 0 ? null : args.splice(i, 2)[1]; };
    const fill = parseInt(take('--fill') ?? 'ff', 16), upper = (take('--upper') ?? 'hardware') as Upper;
    const showListing = args.includes('--listing');
    if (showListing) args.splice(args.indexOf('--listing'), 1);
    const src: string = require('../rom').baseRomOrExit('evermore', args[0]);
    const out = args[1] || join(REPO, 'out', 'soe-sa1.sfc');
    const source = new Uint8Array(readFileSync(src));
    const base = source.length % 1024 === 512 ? source.subarray(512) : source;
    // The derived-ROM marker (multi-game.md §4) goes at the end of the unused block 1.
    const mark = (img: Uint8Array) => markDerived(img, base, 2 * MB - 64, 'sa1');
    const { image, report } = convert(source, { fill, upper, mark });
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, image);
    const b = report.boot, hex = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');
    console.log(`wrote ${out}: 8 MB SA-1 (map mode $${hex(SA1_MAP_MODE, 2)}, type $${hex(SA1_CART_TYPE, 2)}), checksum $${hex(report.checksum, 4)}, fill $${hex(fill, 2)}, 4th MB: ${upper}`);
    console.log(`  $80:802D JML $B8:8000: ${b.bytes.length}-byte boot block (CXB-FXB = ${BANK_VALUES.join(',')}, SBWE = $80), ${b.slowNops} + ${b.fastNops} NOPs, refresh fit ${REFRESH_FIT}`);
    for (const e of report.entries) console.log(`  bank-$00 entry $00:${hex(e.start, 4)} (${e.vectors.join(', ')}): ${e.length} bytes, then ${e.exit}`);
    console.log(`  MesenCE header scores: ${Object.entries(report.scores).map(([k, s]) => `0x${k}=${s}`).join(' ')}`);
    if (showListing) console.log(['', 'boot block:', ...listing(b)].join('\n'));
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
