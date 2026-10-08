'use strict';
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

const { hex } = require('./util');

const SPACE_ROM = 1, BULK = 128;
const XR_DMA = 0x20;

/**
 * @param xrefs  Map<number, number>
 * @param stats  Map<number, {count, lo, hi, flags}>
 * @param points [{s, name}] named code entries (file offsets), for "in <routine>"
 * @returns {{readers: [{pc, where, bytes, dma, bulk}], wide: number}} exact readers first, then
 *          by bytes, at most `limit`; `wide` = range readers left out
 */
function readersOf(xrefs, stats, s, e, points, limit = 24) {
    const byPc = new Map();
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
    const readers = [...byPc.values()].sort((a, b) => (a.bulk - b.bulk) || b.bytes - a.bytes).slice(0, limit).map(r => {
        const off = r.pc & 0x3FFFFF;
        let near = null;
        for (const p of named) { if (p.s > off) break; if ((p.s >> 16) === (off >> 16)) near = p; }
        const where = near && off - near.s < 0x800 ? `${near.name}${off > near.s ? ' +$' + hex(off - near.s, 2) : ''}` : '';
        return { pc: '$' + hex(r.pc >>> 16, 2) + ':' + hex(r.pc & 0xFFFF, 4), where, bytes: r.bytes, dma: r.dma, bulk: r.bulk };
    });
    return { readers, wide };
}

module.exports = { readersOf };
