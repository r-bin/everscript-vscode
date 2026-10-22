// Ownership: what a CDL library says about the *bus* side of the ROM — which
// bank halves code executed from, and how WRAM was used. Pure: takes the
// library's plain maps and arrays (injected by extension.js), never the library.
//
// The CDL stores ROM bytes by file offset, so it cannot say which mirror a data
// read went through. Instruction addresses are bus addresses, though: every
// pcstats key (space << 24 | pc) and every flow edge (from * 2^24 + to) names
// the bank the CPU actually ran from.

const WF_READ = 1, WF_WRITE = 2, WF_EXEC = 0x10;
const WRAM_CELL = 512;
const XREF_WORD = 8;                  // xref flags: the access was 16 bits wide

/**
 * Where the CDL saw 16-bit WRAM accesses start: every xref in space 0 (WRAM) with the word
 * flag names the low byte of a word. `wram.flags` marks both bytes, so it cannot tell
 * `$10-11` from `$11-12`; the xref address can.
 */
function wramWordStarts(xrefs: Map<number, number> | null | undefined): Set<number> {
    const out = new Set<number>();
    for (const [key, flags] of xrefs || new Map<number, number>()) {
        const spaceAddr = key % 0x4000000;
        if ((spaceAddr >>> 24) !== 0 || !(flags & XREF_WORD)) continue;
        out.add(spaceAddr & 0x1FFFF);
    }
    return out;
}

/** The Memory tab's WRAM grid, `lo..hi` (bank $7E offsets): the access flags per byte and the word starts in range. */
function wramCoverage(wflags: ArrayLike<number> | null | undefined, words: Set<number>, lo: number, hi: number): { flags: number[]; words: number[] } {
    const flags: number[] = [];
    for (let a = lo; a <= hi; a++) flags.push(wflags && a < wflags.length ? wflags[a] : 0);
    return { flags, words: [...words].filter((a) => a >= lo && a <= hi).sort((a, b) => a - b) };
}

/** { "<bank*2+upper>": distinct instruction addresses seen there } */
function executedByHalf(stats: Map<number, unknown> | null | undefined, edges: Map<number, unknown> | null | undefined): Record<number, number> {
    const pcs = new Set<number>();
    for (const key of (stats || new Map()).keys()) pcs.add(key & 0xFFFFFF);
    for (const key of (edges || new Map()).keys()) { pcs.add(Math.floor(key / 0x1000000)); pcs.add(key % 0x1000000); }
    const out: Record<number, number> = {};
    for (const pc of pcs) {
        const bank = pc >>> 16;
        if (bank === 0x7E || bank === 0x7F || (((bank & 0x7F) < 0x40) && (pc & 0xFFFF) < 0x8000)) continue;   // WRAM / system area
        const k = bank * 2 + ((pc & 0x8000) ? 1 : 0);
        out[k] = (out[k] || 0) + 1;
    }
    return out;
}

/** Run-length WRAM strip, 512-byte cells: 3 executed, 2 written, 1 read, 0 untouched. */
function wramStrip(wflags: ArrayLike<number> | null | undefined): { strip: [number, number][]; touched: number } | null {
    if (!wflags) return null;
    const out: [number, number][] = [];
    for (let o = 0; o < wflags.length; o += WRAM_CELL) {
        let x = 0, w = 0, r = 0;
        for (let k = o; k < o + WRAM_CELL; k++) { const f = wflags[k]; if (f & WF_EXEC) x++; else if (f & WF_WRITE) w++; else if (f & WF_READ) r++; }
        const key = x ? 3 : w ? 2 : r ? 1 : 0;
        const l = out[out.length - 1];
        if (l && l[0] === key) l[1]++; else out.push([key, 1]);
    }
    let touched = 0;
    for (const f of Array.from(wflags)) if (f & (WF_READ | WF_WRITE | WF_EXEC)) touched++;
    return { strip: out, touched };
}

export { executedByHalf, wramStrip, wramWordStarts, wramCoverage };
