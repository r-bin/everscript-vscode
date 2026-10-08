'use strict';

/**
 * emulator/cdl/functions.js
 *
 * functions.json: one record per recorded function, for recomp, decomp and an
 * SA-1 port. An instruction belongs to the nearest preceding function entry in
 * its bank (xref-index functionOf), which is an approximation for shared tails.
 *   entries, callers, callees, exec count, entry/exit widths (rets), DB/D seen,
 *   WRAM read/write footprint (as ranges), I/O registers, ROM data read,
 *   pointer bases, indirect sites, abnormal returns
 *   sa1.blockers: what keeps the function on the S-CPU. The SA-1 cannot reach
 *     the PPU, APU ports, WRAM port, DMA or S-CPU registers, nor WRAM itself
 *     (WRAM variables would have to move to BW-RAM / I-RAM). transitiveBlockers
 *     adds everything its callees need.
 */

const { hex } = require('./rom-map');
const { SPACE, XR, EXT_HEAD } = require('./xref-index');
const { regsByPc, basesByPc } = require('./library-ext');
const { returnsByEntry } = require('./recomp-analysis');
const { decodeAt } = require('./disasm');

const FLOW_CALL = 1, FLOW_INDIRECT = 8, FLOW_INTERRUPT = 0x10;

function ioClass(a) {
    if (a >= 0x2180 && a <= 0x2183) return 'wram-port';
    if (a >= 0x2140 && a <= 0x2143) return 'apu';
    if (a >= 0x2100 && a <= 0x21FF) return 'ppu';
    if ((a >= 0x4202 && a <= 0x4206) || (a >= 0x4214 && a <= 0x4217)) return 'math';
    if (a >= 0x4300 && a <= 0x437F) return 'dma';
    if (a >= 0x4016 && a <= 0x4017) return 'joypad';
    if (a >= 0x4200 && a <= 0x421F) return 'cpu-io';
    return 'io';
}

function ranges(addrs) {
    const sorted = [...addrs].sort((a, b) => a - b);
    const out = [];
    for (const a of sorted) {
        const last = out[out.length - 1];
        if (last && a <= last[1] + 1) last[1] = a; else out.push([a, a]);
    }
    return out.map(([lo, hi]) => '$' + hex(0x7E0000 + lo, 6) + (hi > lo ? '-$' + hex(0x7E0000 + hi, 6) : ''));
}

function buildFunctions(lib, rom, map, index, tables) {
    const regs = regsByPc(lib), bases = basesByPc(lib), returns = returnsByEntry(lib);
    const byFunc = new Map();
    const fn = off => {
        let f = byFunc.get(off);
        if (!f) {
            f = { off, entries: new Set(), callers: new Set(), callees: new Set(), interrupt: false, wramR: new Set(), wramW: new Set(),
                io: new Map(), rom: new Set(), db: new Set(), d: new Set(), bases: new Set(), indirect: 0, end: off };
            byFunc.set(off, f);
        }
        return f;
    };
    for (const e of index.entries) fn(e);

    for (const [key, kind] of lib.edges) {
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        const toOff = map.busToRom(to);
        if ((kind & (FLOW_CALL | FLOW_INTERRUPT)) && toOff >= 0 && byFunc.has(toOff)) {
            const f = byFunc.get(toOff);
            f.entries.add(to);
            if (kind & FLOW_INTERRUPT) f.interrupt = true;
            else f.callers.add(index.describePc(from));
        }
        const fromOff = map.busToRom(from), owner = fromOff >= 0 ? index.functionOf(fromOff) : -1;
        if (owner >= 0) {
            if ((kind & FLOW_CALL) && toOff >= 0 && byFunc.has(toOff)) fn(owner).callees.add(toOff);
            if (kind & FLOW_INDIRECT) fn(owner).indirect++;
        }
    }

    for (const [pc, list] of index.byPc) {
        const off = map.busToRom(pc);
        const owner = off >= 0 ? index.functionOf(off) : -1;
        if (owner < 0) continue;
        const f = fn(owner);
        for (const x of list) {
            const space = x.spaceAddr >>> 24, a = x.spaceAddr & 0xFFFFFF;
            if (space === SPACE.WRAM) { if (x.flags & XR.READ) f.wramR.add(a); if (x.flags & XR.WRITE) f.wramW.add(a); }
            else if (space === SPACE.IO) f.io.set(a, (f.io.get(a) || '') + (x.flags & XR.READ ? 'R' : '') + (x.flags & XR.WRITE ? 'W' : ''));
            else if (space === SPACE.ROM && !(x.flags & XR.DMA)) f.rom.add(index.labelName(a) || '$' + hex(map.canonical(a), 6));
        }
    }
    for (const [pc, r] of regs) {
        const off = map.busToRom(pc), owner = off >= 0 ? index.functionOf(off) : -1;
        if (owner < 0) continue;
        r.db.forEach(v => fn(owner).db.add(v));
        r.d.forEach(v => fn(owner).d.add(v));
    }
    for (const [pc, list] of bases) {
        const off = map.busToRom(pc), owner = off >= 0 ? index.functionOf(off) : -1;
        if (owner >= 0) list.forEach(b => fn(owner).bases.add(b.base));
    }
    for (let off = 0; off < rom.length; off++) {
        if (!(lib.ext[off] & EXT_HEAD)) continue;
        const owner = index.functionOf(off);
        if (owner < 0) continue;
        const ins = decodeAt(rom, off, lib.cdl[off], lib.ext[off]);
        const f = fn(owner);
        if (ins) f.end = Math.max(f.end, off + ins.len);
    }

    const tableNames = new Map((tables || []).map(t => ['data_' + hex(map.canonical(t.base), 6), 'tbl_' + hex(map.canonical(t.base), 6)]));
    const records = new Map();
    for (const f of byFunc.values()) {
        const io = {};
        for (const [a, rw] of f.io) {
            const c = ioClass(a);
            (io[c] || (io[c] = [])).push('$' + hex(a, 4) + ':' + [...new Set(rw)].join(''));
        }
        const blockers = Object.keys(io).filter(c => c !== 'io');
        if (f.wramR.size || f.wramW.size) blockers.push('wram');
        const entry = [...f.entries][0] || map.canonical(f.off);
        const ret = returns.get(entry);
        records.set(f.off, {
            name: index.labelName(f.off) || 'func_' + hex(map.canonical(f.off), 6),
            romOffset: f.off, size: f.end - f.off, bus: map.canonical(f.off), entries: [...f.entries].map(e => '$' + hex(e, 6)),
            interrupt: f.interrupt, execCount: (lib.romHits && lib.romHits[f.off]) || 0,
            callers: [...f.callers].slice(0, 32), callees: [...f.callees].map(o => index.labelName(o) || '$' + hex(map.canonical(o), 6)),
            widths: ret ? Object.fromEntries([...ret.variants].map(([k, v]) => [k, [...v]])) : {},
            neverReturned: !!(ret && !ret.normal && ret.dropped.size), adjustedReturns: ret ? ret.modified.size : 0,
            db: [...f.db].map(v => '$' + hex(v, 2)), d: [...f.d].map(v => '$' + hex(v, 4)),
            wramReads: ranges(f.wramR), wramWrites: ranges(f.wramW),
            io, romData: [...f.rom].map(n => tableNames.get(n) || n).slice(0, 32),
            pointerBases: [...f.bases].slice(0, 16).map(b => '$' + hex(b, 6)), indirectSites: f.indirect,
            sa1: { blockers, transitiveBlockers: [] },
            calleeOffs: [...f.callees],
        });
    }
    // transitive SA-1 blockers through callees
    const memo = new Map();
    const reach = (off, stack) => {
        if (memo.has(off)) return memo.get(off);
        const r = records.get(off);
        if (!r || stack.has(off)) return new Set(r ? r.sa1.blockers : []);
        stack.add(off);
        const all = new Set(r.sa1.blockers);
        for (const c of r.calleeOffs) reach(c, stack).forEach(b => all.add(b));
        stack.delete(off);
        memo.set(off, all);
        return all;
    };
    const list = [];
    for (const [off, r] of records) {
        r.sa1.transitiveBlockers = [...reach(off, new Set())].sort();
        delete r.calleeOffs;
        list.push(r);
    }
    list.sort((a, b) => a.romOffset - b.romOffset);
    const pure = list.filter(r => !r.sa1.transitiveBlockers.length).length;
    const wramOnly = list.filter(r => r.sa1.transitiveBlockers.length === 1 && r.sa1.transitiveBlockers[0] === 'wram').length;
    return { list, summary: { functions: list.length, pure, wramOnly } };
}

module.exports = { buildFunctions, ioClass };
