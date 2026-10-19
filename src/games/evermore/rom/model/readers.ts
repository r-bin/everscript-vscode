// Ownership: "which code reads these ROM bytes", answered from a CDL library's
// cross references. Pure: takes the library's `xrefs` / `stats` maps, never the
// library object, so this domain does not depend on the emulator.
//
// xrefs: key = pc * 0x4000000 + (space << 24 | addr), value = flags; ROM space
// addr is a file offset. stats: key = space << 24 | pc, value {count, lo, hi, flags},
// a PC with 128+ addresses is kept as a range (bulk) instead of exact xrefs.
// A range says only "somewhere between lo and hi": a decompressor's spans most
// of the ROM. So a bulk reader counts only when its whole range sits in the
// region's 32 KB half; wider ones are counted, not listed.

import { hex } from './util';
import { hiromFileOffset } from '../../../../platform/snes/hirom';

const SPACE_ROM = 1, BULK = 128;
const XR_DMA = 0x20;

/** A PC's address statistics in the CDL library. */
interface PcStat { count: number; lo: number; hi: number; flags: number }
interface Reader { pc: string; where: string; bytes: number; dma: boolean; bulk: boolean }
interface ReaderCount { pc: number; bytes: number; dma: boolean; bulk: boolean }

/**
 * The code that reads file offsets s..e: exact readers first, then by bytes, at most `limit`; `wide`
 * counts the range readers left out. `points` are named code entries (file offsets), for "in <routine>".
 */
function readersOf(xrefs: Map<number, number> | null | undefined, stats: Map<number, PcStat> | null | undefined, s: number, e: number,
    points: { s: number; name: string }[], limit = 24): { readers: Reader[]; wide: number } {
    const byPc = new Map<number, ReaderCount>();
    for (const [key, flags] of xrefs || []) {
        const spaceAddr = key % 0x4000000;
        if ((spaceAddr >>> 24) !== SPACE_ROM) continue;
        const off = spaceAddr & 0xFFFFFF;
        if (off < s || off >= e) continue;
        const pc = Math.floor(key / 0x4000000);
        const r = byPc.get(pc) || { pc, bytes: 0, dma: false, bulk: false };
        r.bytes++;
        if (flags & XR_DMA) r.dma = true;
        byPc.set(pc, r);
    }
    let wide = 0;
    for (const [key, st] of stats || []) {
        if ((key >>> 24) !== SPACE_ROM || st.count < BULK || st.hi < s || st.lo >= e) continue;
        const pc = key & 0xFFFFFF;
        if ((st.lo >> 15) !== (s >> 15) || (st.hi >> 15) !== (s >> 15)) { if (!byPc.has(pc)) wide++; continue; }
        const r = byPc.get(pc) || { pc, bytes: 0, dma: false, bulk: false };
        r.bulk = true;
        r.bytes = Math.max(r.bytes, Math.min(st.hi + 1, e) - Math.max(st.lo, s));
        byPc.set(pc, r);
    }
    const named = points.slice().sort((a, b) => a.s - b.s);
    const readers = [...byPc.values()].sort((a, b) => (Number(a.bulk) - Number(b.bulk)) || b.bytes - a.bytes).slice(0, limit).map(r => {
        const off = hiromFileOffset(r.pc);
        let near: { s: number; name: string } | null = null;
        for (const p of named) { if (p.s > off) break; if ((p.s >> 16) === (off >> 16)) near = p; }
        const where = near && off - near.s < 0x800 ? `${near.name}${off > near.s ? ' +$' + hex(off - near.s, 2) : ''}` : '';
        return { pc: '$' + hex(r.pc >>> 16, 2) + ':' + hex(r.pc & 0xFFFF, 4), where, bytes: r.bytes, dma: r.dma, bulk: r.bulk };
    });
    return { readers, wide };
}

export type { PcStat, Reader };
export { readersOf };
