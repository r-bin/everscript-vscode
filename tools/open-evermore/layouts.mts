// The cartridge layouts implode builds (docs/open-evermore/manifest.md §1.1). Implode places resources in a
// *content* image, HiROM-mapped like the base ROM; a layout says how large it may be, which space beyond the base is
// free, how the game points at a byte, and how the content becomes the cartridge image. SNES facts and the repo's
// converters (tools/exhirom, tools/sa1); the one game fact is Evermore's read of bank $B0 (below), passed in.
//
//   hirom      3 MiB (vanilla) or 4 MiB, the 4th MB free ("hirom + extension"): $C0-$FF, $80-$BF:8000+
//   exhirom    8 MiB: the first 4 MB as hirom, then $40-$7D (slow ROM) for the second 4 MB; bank $40 holds the
//              converter's header copy and bank-$00 vector stubs, $7E-$7F are WRAM
//   sa1        an 8 MiB SA-1 image of a 4 MiB HiROM content (tools/sa1): the same free space as 4 MiB hirom, minus
//              the boot block, which the SA-1's code view puts at $B8:8000
import { createRequire } from 'node:module';
import type { Span } from './codec.mts';
import type { Layout } from './manifest.mts';
import { writeChecksum } from './manifest.mts';

const require = createRequire(import.meta.url);
const MB = 0x100000;
/** The header's ROM size byte: 1 KiB << n (hardware). */
const ROM_SIZE = 0xFFD7;

export interface Plan {
    layout: Layout;
    /** Bytes of the content image. */
    content: number;
    /** What the build answers for the cartridge size, for reports. */
    label: string;
    /** Free space beyond the base image (file offsets in the content). */
    free: Span[];
    /** Content bytes the plan writes itself (held out of `free`). */
    prepare(content: Uint8Array, baseLength: number): void;
    /** The 24-bit address the game uses for content offset `at`: $80-$BF in an upper half, $C0-$FF in a lower one
     *  (as vanilla points), $40-$7D in an ExHiROM second half. */
    pointer(at: number): number;
    /** The cartridge image, checksum included. */
    build(content: Uint8Array): Uint8Array;
}

/**
 * Bytes the game reads past a 3 MiB image that must answer as the original did: Evermore's $80:D113 reads
 * $B0:E293+X (X ≤ $780, 64 bytes; knowledge row_table_low_bytes_from_bank_b0). Filled with what our snes9x core
 * answered for the 3 MiB original (offset modulo the size), so lockstep proofs stay exact; the WRAM it lands in is
 * never read, so any value plays the same.
 */
export interface PastEnd { start: number; end: number }

const hiromPointer = (at: number) => (at & 0xFFFF) >= 0x8000 ? 0x800000 | at : 0xC00000 | at;

function minus(spans: Span[], holes: Span[]): Span[] {
    let out = spans;
    for (const h of holes) out = out.flatMap(s => h.end <= s.start || h.start >= s.end ? [s] : [{ start: s.start, end: h.start }, { start: h.end, end: s.end }].filter(x => x.end > x.start));
    return out;
}

/** The plan for `layout` with `content` bytes (hirom: the base size or 4 MiB). */
export function plan(layout: Layout, content: number, baseLength: number, pastEnd: PastEnd[]): Plan {
    const mirror = (c: Uint8Array) => { for (const p of pastEnd) for (let o = p.start; o < p.end && o < c.length; o++) c[o] = c[o % baseLength]; };
    const fourth = (holes: Span[] = []) => content > baseLength ? minus([{ start: baseLength, end: Math.min(content, 4 * MB) }], [...pastEnd, ...holes]) : [];
    if (layout === 'hirom') {
        return {
            layout, content, label: `HiROM ${content / MB} MiB`, free: fourth(), prepare: mirror, pointer: hiromPointer,
            build: c => {
                const image = c.slice();
                // A grown image must not be larger than the header says (Evermore's 3 MiB already declares 4 MiB).
                while (image[ROM_SIZE] && (1024 << image[ROM_SIZE]) < image.length) image[ROM_SIZE]++;
                writeChecksum(image);
                return image;
            },
        };
    }
    if (layout === 'sa1') {
        const boot = { start: 0x388000, end: 0x390000 };   // $B8:8000-$B8:FFFF, the boot block's half bank (tools/sa1)
        return {
            layout, content, label: 'SA-1 8 MiB (4 MiB HiROM content)', free: fourth([boot]), prepare: mirror, pointer: hiromPointer,
            build: c => { const hirom = c.slice(); writeChecksum(hirom); return require('../sa1/convert.mts').convert(hirom).image; },
        };
    }
    // exhirom: the second 4 MB from bank $41 to $7D.
    const second = { start: 4 * MB + 0x10000, end: 4 * MB + 0x3E0000 };
    return {
        layout, content, label: 'ExHiROM 8 MiB', free: [...fourth(), second], prepare: mirror,
        pointer: at => at < 4 * MB ? hiromPointer(at) : (((0x40 + ((at - 4 * MB) >> 16)) << 16) | (at & 0xFFFF)),
        build: c => {
            const { convert } = require('../exhirom/convert.js');
            const image: Uint8Array = convert(c.subarray(0, 4 * MB), { upper: 'fill' }).image;
            image.set(c.subarray(second.start, second.end), second.start);
            writeChecksum(image, [0xFFDC, 4 * MB + 0xFFDC]);
            return image;
        },
    };
}
