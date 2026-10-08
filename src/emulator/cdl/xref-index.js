'use strict';

/**
 * emulator/cdl/xref-index.js
 *
 * Turns library data into the questions the export answers:
 *   - what is a function (call / interrupt targets, vectors) and who calls it
 *   - which function an instruction belongs to (nearest preceding entry)
 *   - who reads / writes an address (exact xrefs + bulk ranges of capped PCs)
 *   - which script instructions touched a WRAM address (script-xrefs)
 *   - which ROM offsets deserve a label
 */

const { hex } = require('./rom-map');

const CDL_CODE = 0x01, CDL_DATA = 0x02, CDL_JUMP = 0x04, CDL_SUB = 0x08;
const EXT_HEAD = 0x04, EXT_POINTER = 0x20;
const SPACE = { WRAM: 0, ROM: 1, BUS: 2, IO: 3 };
const SPACE_NAMES = ['wram', 'rom', 'bus', 'io'];
const FLOW_CALL = 1, FLOW_INTERRUPT = 0x10;
const XR = { READ: 1, WRITE: 2, BYTE: 4, WORD: 8, POINTER: 0x10, DMA: 0x20, DMA_VRAM: 0x40, DMA_CGRAM: 0x80 };
const XREFS_PER_PC = 128;
const SCRIPT_BULK = 64;   // a script touching more addresses (room loads, decompression) is a range

function push(map, key, value) {
    const list = map.get(key);
    if (list) list.push(value); else map.set(key, [value]);
}

function buildIndex(lib, map) {
    const { cdl, ext } = lib;
    const labels = new Map();          // rom offset -> 'func' | 'loc' | 'data' | 'gfx' | 'ptrs'
    const callers = new Map();         // rom offset -> [{ from, kind }]
    const byAddr = new Map();          // space<<24|addr -> [{ pc, flags }]
    const byPc = new Map();            // pc -> [{ spaceAddr, flags }]
    const bulk = [];                   // { pc, space, lo, hi, flags }
    const scriptsByAddr = new Map();   // wram addr -> [{ script, flags }]
    const scriptSpan = new Map();      // script -> { count, lo, hi }

    const setLabel = (off, kind) => {
        const rank = { func: 5, loc: 4, gfx: 3, hdma: 3, ptrs: 2, data: 1 };
        const old = labels.get(off);
        if (!old || rank[kind] > rank[old]) labels.set(off, kind);
    };

    for (let off = 0; off < cdl.length; off++) {
        const c = cdl[off];
        if (!c) continue;
        if ((c & CDL_SUB) && (ext[off] & EXT_HEAD)) setLabel(off, 'func');
        else if ((c & CDL_JUMP) && (ext[off] & EXT_HEAD)) setLabel(off, 'loc');
        if ((ext[off] & EXT_POINTER) && !(off > 0 && (ext[off - 1] & EXT_POINTER))) setLabel(off, 'ptrs');
    }

    const header = map.header;
    if (header) {
        for (const v of [header.nativeVectors.nmi, header.nativeVectors.irq, header.nativeVectors.brk, header.nativeVectors.cop]) {
            const off = map.busToRom(v);
            if (off >= 0 && (ext[off] & EXT_HEAD)) setLabel(off, 'func');
        }
    }

    for (const [key, kind] of lib.edges) {
        const from = Math.floor(key / 0x1000000);
        const to = key % 0x1000000;
        const off = map.busToRom(to);
        if (off < 0) continue;
        push(callers, off, { from, kind });
        if (kind & (FLOW_CALL | FLOW_INTERRUPT)) setLabel(off, 'func');
    }

    for (const [key, flags] of lib.xrefs) {
        const pc = Math.floor(key / 0x4000000);
        const spaceAddr = key % 0x4000000;
        push(byAddr, spaceAddr, { pc, flags });
        push(byPc, pc, { spaceAddr, flags });
    }

    for (const [key, flags] of lib.scriptXrefs || []) {
        const script = Math.floor(key / 0x20000), addr = key % 0x20000;
        push(scriptsByAddr, addr, { script, flags });
        const sp = scriptSpan.get(script);
        if (sp) { sp.count++; sp.lo = Math.min(sp.lo, addr); sp.hi = Math.max(sp.hi, addr); }
        else scriptSpan.set(script, { count: 1, lo: addr, hi: addr });
    }

    for (const [key, s] of lib.stats) {
        const space = key >>> 24, pc = key & 0xFFFFFF;
        if (s.count >= XREFS_PER_PC) bulk.push({ pc, space, lo: s.lo, hi: s.hi, flags: s.flags });
    }

    // Data labels: the base of what each instruction reads from ROM (its lowest
    // address), every address when it touches only a few, DMA sources as gfx.
    for (const [pc, list] of byPc) {
        const rom = list.filter(x => (x.spaceAddr >>> 24) === SPACE.ROM);
        if (!rom.length) continue;
        let low = Infinity;
        for (const x of rom) {
            const off = x.spaceAddr & 0xFFFFFF;
            if (x.flags & XR.DMA) { setLabel(off, pc === 0 ? 'hdma' : 'gfx'); continue; }
            if (off < low) low = off;
            if (rom.length <= 4 && !(cdl[off] & CDL_CODE)) setLabel(off, 'data');
        }
        if (low !== Infinity && !(cdl[low] & CDL_CODE)) setLabel(low, 'data');
    }

    const entries = [...labels].filter(([, k]) => k === 'func').map(([o]) => o).sort((a, b) => a - b);

    function functionOf(off) {
        let lo = 0, hi = entries.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (entries[mid] <= off) { best = entries[mid]; lo = mid + 1; } else hi = mid - 1;
        }
        return best >= 0 && (best >>> 16) === (off >>> 16) ? best : -1;
    }

    function labelName(off) {
        const kind = labels.get(off);
        return kind ? kind + '_' + hex(map.canonical(off), 6) : null;
    }

    /** "func_C08000+$12 (80:8012)" for a bus PC. */
    function describePc(pc) {
        const where = hex(pc >>> 16, 2) + ':' + hex(pc & 0xFFFF, 4);
        if (pc === 0) return 'interrupt / HDMA';
        const off = map.busToRom(pc);
        if (off < 0) return where;
        const f = functionOf(off);
        if (f < 0) return where;
        const d = off - f;
        return labelName(f) + (d ? '+$' + hex(d, d > 0xFF ? 4 : 2) : '') + ' (' + where + ')';
    }

    /** Accessors of one address, exact xrefs plus bulk ranges that cover it. */
    function accessorsOf(space, addr) {
        const exact = (byAddr.get((space << 24) | addr) || []).map(x => ({ pc: x.pc, flags: x.flags, bulk: false }));
        const seen = new Set(exact.map(x => x.pc));
        for (const b of bulk) {
            if (b.space === space && addr >= b.lo && addr <= b.hi && !seen.has(b.pc)) {
                exact.push({ pc: b.pc, flags: b.flags, bulk: true, lo: b.lo, hi: b.hi });
            }
        }
        return exact.sort((a, b) => a.pc - b.pc);
    }

    /** Script instructions that touched a WRAM address; bulk when the script touched many. */
    function scriptAccessorsOf(addr) {
        return (scriptsByAddr.get(addr) || []).map(x => {
            const sp = scriptSpan.get(x.script);
            return { script: x.script, flags: x.flags, bulk: sp.count > SCRIPT_BULK, count: sp.count, lo: sp.lo, hi: sp.hi };
        }).sort((a, b) => a.script - b.script);
    }

    return { labels, callers, byAddr, byPc, bulk, entries, functionOf, labelName, describePc, accessorsOf, scriptAccessorsOf };
}

function flagText(flags) {
    const rw = (flags & XR.READ ? 'R' : '') + (flags & XR.WRITE ? 'W' : '');
    const w = (flags & XR.WORD ? '16' : '') + (flags & XR.BYTE ? (flags & XR.WORD ? '/8' : '8') : '');
    const extra = (flags & XR.POINTER ? ' ptr' : '') + (flags & XR.DMA ? (flags & XR.DMA_VRAM ? ' dma>vram' : flags & XR.DMA_CGRAM ? ' dma>cgram' : ' dma') : '');
    return (rw.padEnd(2) + ' ' + w).trim() + extra;
}

module.exports = { buildIndex, flagText, SPACE, SPACE_NAMES, XR, CDL_CODE, CDL_DATA, EXT_HEAD, XREFS_PER_PC };
