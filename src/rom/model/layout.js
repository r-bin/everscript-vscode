'use strict';
// Ownership: turning region claims into what the ROM tab shows — one byte one
// owner, the rows of every 32 KB half (regions, points, gaps), overlap notes,
// colour strips and CDL coverage. Pure.
//
// Ownership of a byte: higher priority wins, then the later start (a region's
// start is certain, a measured end less so), then the earlier claim.

const { bus } = require('./util');

const HALF = 0x8000, CELL = 128;
const CDL_CODE = 0x01, CDL_DATA = 0x02;

function owners(regions, size) {
    const owner = new Int32Array(size).fill(-1);
    const order = regions.map((_, i) => i).sort((a, b) =>
        regions[b].prio - regions[a].prio || regions[b].s - regions[a].s || a - b);
    for (const i of order) {
        const r = regions[i];
        for (let o = r.s; o < Math.min(r.e, size); o++) if (owner[o] < 0) owner[o] = i;
    }
    return owner;
}

/** Notes on named regions: what overlaps them, and graphics that reuse their bytes. */
function annotateOverlaps(regions, graphics) {
    const named = regions.filter(r => r.prio > 0 && r.cat !== '🖼️' && r.cat !== '🧍').sort((a, b) => a.s - b.s);
    for (let i = 0; i < named.length; i++) {
        const a = named[i];
        for (let j = i + 1; j < named.length && named[j].s < a.e; j++) {
            a.notes += ` · ⚠ measured end runs ${Math.min(a.e, named[j].e) - named[j].s} B into ${named[j].name.split(' · ')[0]}`;
            a.warn = true;
        }
    }
    const byStart = graphics.slice().sort((x, y) => x.s - y.s);
    for (const a of named) {
        const ids = [];
        for (const g of byStart) { if (g.s >= a.e) break; if (g.e > a.s) ids.push(g.id); }
        if (ids.length) a.notes += ` · bytes also read as map graphic${ids.length > 1 ? 's' : ''} ${ids.join(', ')}`;
    }
}

function cdlCounts(cdl, s, e) {
    let code = 0, data = 0;
    for (let o = s; o < e; o++) { const c = cdl[o]; if (c & CDL_CODE) code++; else if (c & CDL_DATA) data++; }
    return { code, data };
}

function allFill(rom, s, e) {
    const v = rom[s];
    if (v !== 0 && v !== 0xFF) return -1;
    for (let o = s + 1; o < e; o++) if (rom[o] !== v) return -1;
    return v;
}

/** Run-length colour strip of one half: [[key, cells], …], 128-byte cells, majority key. */
function strip(lo, keyAt) {
    const out = [];
    for (let o = lo; o < lo + HALF; o += CELL) {
        const n = new Map();
        for (let k = o; k < o + CELL; k += 4) { const c = keyAt(k); n.set(c, (n.get(c) || 0) + 1); }
        let best = null, bn = -1;
        for (const [c, v] of n) if (v > bn) { best = c; bn = v; }
        const l = out[out.length - 1];
        if (l && l[0] === best) l[1]++; else out.push([best, 1]);
    }
    return out;
}

/**
 * @param rom     ROM bytes (no copier header)
 * @param regions [{s, e, cat, name, notes, area, prio, room?}]
 * @param points  [{s, cat, name, notes}]
 * @param cdl     Uint8Array per ROM byte, or null
 */
function layoutHalves(rom, regions, points, cdl) {
    const size = rom.length, owner = owners(regions, size);
    const catAt = o => owner[o] >= 0 ? regions[owner[o]].cat : (cdl && cdl[o] & CDL_CODE ? '🧠' : '⬜');
    const cdlAt = o => !cdl ? 0 : cdl[o] & CDL_CODE ? 1 : cdl[o] & CDL_DATA ? 2 : 0;
    const halves = [];
    const totals = { mapped: 0, code: 0, unknown: 0, free: 0, cdlCode: 0, cdlData: 0 };
    const pts = points.slice().sort((a, b) => a.s - b.s);
    let pi = 0;
    for (let lo = 0; lo < size; lo += HALF) {
        const hi = Math.min(lo + HALF, size), rows = [];
        const h = { bank: lo >> 16, upper: (lo & HALF) !== 0, lo, mapped: 0, code: 0, unknown: 0, free: 0, rows };
        const emitPoints = upto => {
            for (; pi < pts.length && pts[pi].s < upto; pi++) {
                const p = pts[pi];
                if (p.s >= lo) rows.push({ a: p.s, n: null, cat: p.cat, name: p.name, notes: p.notes, area: '', addr: bus(p.s) });
            }
        };
        for (let o = lo; o < hi;) {
            const i = owner[o];
            let e = o + 1;
            while (e < hi && owner[e] === i) e++;
            emitPoints(o);
            const n = e - o, row = { a: o, n, addr: bus(o) };
            if (cdl) row.cdl = cdlCounts(cdl, o, e);
            if (i >= 0) {
                const g = regions[i];
                Object.assign(row, { cat: g.cat, name: g.name, notes: g.notes, area: g.area || '', room: g.room, warn: !!g.warn,
                    part: g.prio > 0 && (o !== g.s || e !== g.e) });
                h.mapped += n;
            } else {
                const fill = allFill(rom, o, e);
                if (fill >= 0 && n >= 16) { Object.assign(row, { cat: '🟫', name: 'Free', gap: 'free', notes: `filled with $${fill.toString(16).toUpperCase().padStart(2, '0')}` }); h.free += n; }
                else if (row.cdl && row.cdl.code) { Object.assign(row, { cat: '🧠', name: 'Code (unnamed)', gap: 'code', notes: 'not mapped yet' }); h.code += n; }
                else { Object.assign(row, { cat: '⬜', name: 'Unmapped', gap: 'unmapped', notes: '' }); h.unknown += n; }
                row.area = '';
            }
            rows.push(row);
            o = e;
        }
        emitPoints(hi);
        h.strip = strip(lo, o => o < size ? catAt(o) : '⬜');
        if (cdl) {
            h.cdlStrip = strip(lo, o => o < size ? cdlAt(o) : 0);
            h.cdl = cdlCounts(cdl, lo, hi);
            totals.cdlCode += h.cdl.code; totals.cdlData += h.cdl.data;
        }
        for (const k of ['mapped', 'code', 'unknown', 'free']) totals[k] += h[k];
        halves.push(h);
    }
    return { halves, totals };
}

module.exports = { annotateOverlaps, layoutHalves };
