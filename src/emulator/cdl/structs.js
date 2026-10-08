'use strict';

/**
 * emulator/cdl/structs.js
 *
 * WRAM struct inference. Every access that splits into "instance base" +
 * "field offset" votes; accesses that see the same set of instances are one
 * struct. Three sources:
 *   - abs,X / abs,Y / long,X (index = effective - operand; operand static)
 *       X holds instance addresses (lda $0010,x) -> instances = indices, field = operand
 *       X holds slot offsets (lda $3DE5,x)       -> instances = lowest operand + indices
 *   - pointer accesses (dp),Y / [dp],Y / (sr,S),Y (bases.bin + Y from regs.bin)
 *       instances = pointer values in WRAM, fields = Y values
 *   - direct page with D != 0 (regs.bin)        -> instances = D values, field = operand
 * Instance sets that share at least half of the smaller one (and two members)
 * and sit on the bigger one's stride merge into one struct; byte-stride groups whose fields run past the stride
 * (array loops, not records) are dropped.
 * Outputs: structs.asm (defines), structs.h (C), structs.json.
 */

const { hex } = require('./rom-map');
const { decodeAt } = require('./disasm');
const { SPACE, XR, EXT_HEAD } = require('./xref-index');
const { regsByPc, basesByPc } = require('./library-ext');

const WRAM_SIZE = 0x20000;
const MAX_FIELD = 0x400;

function wramOf(bus) {
    const bank = (bus >>> 16) & 0xFF, a = bus & 0xFFFF;
    if (bank === 0x7E || bank === 0x7F) return (bank - 0x7E) * 0x10000 + a;
    if ((bank & 0x7F) < 0x40 && a < 0x2000) return a;
    return -1;
}

const minGap = list => list.slice(1).reduce((g, v, i) => Math.min(g, v - list[i]), Infinity);

function inferStructs(lib, rom, map, index) {
    const regs = regsByPc(lib), bases = basesByPc(lib);
    const votes = [];   // { instances: number[], field, width, read, write, pc }
    const head = off => (off >= 0 && (lib.ext[off] & EXT_HEAD) ? decodeAt(rom, off, lib.cdl[off], lib.ext[off]) : null);

    for (const [pc, list] of index.byPc) {
        const wram = list.filter(x => (x.spaceAddr >>> 24) === SPACE.WRAM && !(x.flags & XR.DMA));
        if (!wram.length) continue;
        const ins = head(map.busToRom(pc));
        if (!ins) continue;
        const flags = wram.reduce((f, x) => f | x.flags, 0);
        const vote = { width: flags & XR.WORD ? 2 : 1, read: !!(flags & XR.READ), write: !!(flags & XR.WRITE), pc };
        const r = regs.get(pc);
        const addrs = wram.map(x => x.spaceAddr & 0xFFFFFF);

        if (ins.mode === 'absx' || ins.mode === 'absy' || ins.mode === 'longx') {
            let base;
            if (ins.mode === 'longx') base = wramOf(ins.operand);
            else {
                const dbs = r ? [...r.db] : [0x7E];
                base = dbs.length === 1 ? wramOf((dbs[0] << 16) | ins.operand) : -1;
            }
            if (base < 0) continue;
            const idx = [...new Set(addrs.map(a => a - base).filter(i => i >= 0 && i < WRAM_SIZE))].sort((a, b) => a - b);
            if (idx.length < 2) continue;
            if (base < 0x100 || idx[0] >= 0x100) votes.push({ ...vote, instances: idx, field: base, slot: false });
            else votes.push({ ...vote, instances: idx, field: base, slot: true });
            continue;
        }
        const b = bases.get(pc);
        if (b && b.length) {
            const inst = [...new Set(b.map(x => wramOf(x.base)).filter(w => w >= 0))].sort((x, y) => x - y);
            if (inst.length < 1) continue;
            const ys = b.some(x => x.flags & 1) && r && r.y.size ? [...r.y] : [0];
            for (const y of ys.slice(0, 8)) if (y < MAX_FIELD) votes.push({ ...vote, instances: inst, field: y, slot: false });
            continue;
        }
        if (r && (ins.mode === 'dp' || ins.mode === 'dpx' || ins.mode === 'dpy')) {
            const ds = [...r.d].filter(d => d !== 0).map(d => wramOf(d)).filter(w => w >= 0).sort((x, y) => x - y);
            if (ds.length >= 1 && ins.mode === 'dp') votes.push({ ...vote, instances: ds, field: ins.operand, slot: false });
        }
    }

    // slot-style votes: the struct starts at the lowest field address of the group
    const groups = new Map();
    for (const v of votes) {
        const key = (v.slot ? 's:' : 'i:') + v.instances.join(',');
        (groups.get(key) || groups.set(key, { slot: v.slot, idx: v.instances, votes: [] }).get(key)).votes.push(v);
    }
    let structs = [];
    for (const g of groups.values()) {
        const lo = g.slot ? Math.min(...g.votes.map(v => v.field)) : 0;
        const instances = g.slot ? g.idx.map(i => lo + i) : g.idx;
        const fields = new Map();
        for (const v of g.votes) {
            const off = v.field - lo;
            if (off < 0 || off >= MAX_FIELD) continue;
            const f = fields.get(off) || fields.set(off, { width: 1, read: false, write: false, pcs: new Set() }).get(off);
            f.width = Math.max(f.width, v.width); f.read = f.read || v.read; f.write = f.write || v.write; f.pcs.add(v.pc);
        }
        if (fields.size) structs.push({ instances, fields });
    }

    // merge overlapping instance sets (bigger sets first)
    structs.sort((a, b) => b.instances.length - a.instances.length || a.instances[0] - b.instances[0]);
    const merged = [];
    for (const s of structs) {
        const set = new Set(s.instances);
        const into = merged.find(m => {
            const shared = s.instances.filter(i => m.set.has(i)).length;
            if (shared < 2 || shared * 2 < Math.min(s.instances.length, m.set.size)) return false;
            const stride = minGap(m.instances);
            return s.instances.every(i => (i - m.instances[0]) % stride === 0);
        });
        if (into) {
            s.instances.forEach(i => into.set.add(i));
            into.instances = [...into.set].sort((a, b) => a - b);
            for (const [off, f] of s.fields) {
                const g = into.fields.get(off);
                if (!g) into.fields.set(off, f);
                else { g.width = Math.max(g.width, f.width); g.read = g.read || f.read; g.write = g.write || f.write; f.pcs.forEach(p => g.pcs.add(p)); }
            }
        } else merged.push({ ...s, set });
    }

    const names = new Map();
    return merged.filter(s => s.instances.length >= 2 && s.fields.size >= 2).map(s => {
        const inst = s.instances;
        const gaps = inst.slice(1).map((v, i) => v - inst[i]);
        const stride = gaps.length ? Math.min(...gaps) : 0;
        const fields = [...s.fields].sort((a, b) => a[0] - b[0]).map(([offset, f]) => ({ offset, width: f.width, read: f.read, write: f.write, accessors: f.pcs.size, pcs: [...f.pcs] }));
        const size = Math.max(...fields.map(f => f.offset + f.width));
        const base = 'struct_' + hex(0x7E0000 + inst[0], 6);
        const n = (names.get(base) || 0) + 1;
        names.set(base, n);
        return { name: n > 1 ? base + '_' + n : base, instances: inst, stride, size, overlaps: !!stride && size > stride, fields };
    }).filter(s => !(s.overlaps && s.stride < 4)).sort((a, b) => b.fields.length * b.instances.length - a.fields.length * a.instances.length);
}

function structsAsm(structs, index) {
    const lines = ['; Generated by Everscript from the CDL library: WRAM structs (instances x fields).',
        '; Rename freely; ram.asm has every address with its accessors.', ''];
    for (const s of structs) {
        lines.push(`; ${s.name}: ${s.instances.length} instances, stride $${hex(s.stride, 2)}, size >= $${hex(s.size, 2)}` + (s.overlaps ? '  (fields reach past the stride: two structs mixed?)' : ''));
        s.instances.forEach((a, i) => lines.push(`!${s.name}_${i} = $${hex(0x7E0000 + a, 6)}`));
        for (const f of s.fields) {
            const who = f.pcs.slice(0, 3).map(pc => index.describePc(pc)).join(', ') + (f.pcs.length > 3 ? ', +' + (f.pcs.length - 3) : '');
            lines.push(`!${s.name}_f${hex(f.offset, 2)} = $${hex(f.offset, 2)}`.padEnd(36) + `; ${f.width === 2 ? 'word' : 'byte'} ${(f.read ? 'R' : '') + (f.write ? 'W' : '')}  ${who}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

function structsHeader(structs) {
    const out = ['/* Generated by Everscript from the CDL library: WRAM structs. Field names are offsets. */', '#pragma once', '#include <stdint.h>', ''];
    for (const s of structs) {
        const shown = s.instances.slice(0, 16).map(a => '$' + hex(0x7E0000 + a, 6)).join(' ') + (s.instances.length > 16 ? ' ...' : '');
        out.push(`/* ${s.instances.length} instances, stride $${hex(s.stride, 2)}: ${shown} */`, 'typedef struct {');
        let at = 0;
        for (const f of s.fields) {
            if (f.offset < at) continue;
            if (f.offset > at) out.push(`    uint8_t pad${hex(at, 2)}[${f.offset - at}];`);
            out.push(`    ${f.width === 2 ? 'uint16_t' : 'uint8_t'} f${hex(f.offset, 2)};`);
            at = f.offset + f.width;
        }
        if (s.stride > at && !s.overlaps) out.push(`    uint8_t pad${hex(at, 2)}[${s.stride - at}];`);
        out.push(`} ${s.name}_t;`, '');
    }
    return out.join('\n');
}

module.exports = { inferStructs, structsAsm, structsHeader };
