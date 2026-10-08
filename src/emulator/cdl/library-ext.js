'use strict';

/**
 * emulator/cdl/library-ext.js
 *
 * The library streams added for recomp / decomp work (v0.174.0), kept out of
 * library.js so that file stays about storage and the original streams:
 *   rets.bin         [entry, retPc, mx<<8|flags]   shadow call stack outcomes   OR
 *   regs.bin         [pc, kind<<16|value]          DB / D per instruction, Y at pointer sites   union
 *   bases.bin        [pc, base24, flags]           pointer behind (dp),Y / [dp],Y / (sr,S),Y   OR
 *   wram-code.bin    128 KB  first bytes seen executing from WRAM
 *   wram-code.state  128 KB  1 seen, 2 executed again with other bytes                   OR
 *   aram.cdl         64 KB   SPC700: 1 exec, 2 operand, 4 read, 8 write                  OR
 * All merges are order independent except which bytes wram-code.bin keeps when two
 * sessions saw different code: the state then says CHANGED either way.
 */

const WRAM_SIZE = 0x20000;
const ARAM_SIZE = 0x10000;
const RET = { NORMAL: 1, MODIFIED: 2, DROPPED: 4, INTERRUPT: 8 };
const REG = { DB: 0, D: 1, Y: 2 };
const BASE = { Y: 1, LONG: 2, STACK: 4 };
const WCODE = { SEEN: 1, CHANGED: 2 };
const ARAM = { EXEC: 1, OPERAND: 2, READ: 4, WRITE: 8 };

const retKey = (entry, retPc, mx) => (entry * 0x1000000 + retPc) * 16 + (mx & 0xF);
const regKey = (pc, kv) => pc * 0x100000 + kv;
const baseKey = (pc, base) => pc * 0x1000000 + base;

function initExt(lib) {
    lib.rets = new Map();
    lib.regs = new Set();
    lib.bases = new Map();
    lib.wcode = new Uint8Array(WRAM_SIZE);
    lib.wcodeState = new Uint8Array(WRAM_SIZE);
    lib.aram = new Uint8Array(ARAM_SIZE);
}

function orInto(map, key, flags) {
    const old = map.get(key) || 0;
    if ((old | flags) === old) return false;
    map.set(key, old | flags);
    return true;
}

/** Merge the extension part of a delta (or of loaded files); touch(name) marks a file dirty. */
function mergeExt(lib, d, touch) {
    if (d.rets) for (let i = 0; i + 2 < d.rets.length; i += 3) {
        if (orInto(lib.rets, retKey(d.rets[i], d.rets[i + 1], d.rets[i + 2] >>> 8), d.rets[i + 2] & 0xFF)) touch('rets.bin');
    }
    if (d.regs) for (let i = 0; i + 1 < d.regs.length; i += 2) {
        const k = regKey(d.regs[i], d.regs[i + 1]);
        if (!lib.regs.has(k)) { lib.regs.add(k); touch('regs.bin'); }
    }
    if (d.bases) for (let i = 0; i + 2 < d.bases.length; i += 3) {
        if (orInto(lib.bases, baseKey(d.bases[i], d.bases[i + 1]), d.bases[i + 2])) touch('bases.bin');
    }
    for (const c of d.wcode || []) {
        const base = c.index * c.code.length;
        for (let i = 0; i < c.code.length && base + i < WRAM_SIZE; i++) {
            const st = c.state[i];
            if (!st) continue;
            const a = base + i, old = lib.wcodeState[a];
            let next = old | st;
            if (!(old & WCODE.SEEN)) lib.wcode[a] = c.code[i];
            else if (lib.wcode[a] !== c.code[i]) next |= WCODE.CHANGED;
            if (next !== old) { lib.wcodeState[a] = next; touch('wram-code.bin'); touch('wram-code.state'); }
        }
    }
    for (const c of d.aram || []) {
        const base = c.index * c.data.length;
        for (let i = 0; i < c.data.length && base + i < ARAM_SIZE; i++) {
            const v = lib.aram[base + i] | c.data[i];
            if (v !== lib.aram[base + i]) { lib.aram[base + i] = v; touch('aram.cdl'); }
        }
    }
}

/** Load the extension files: readRecords(name, magic, words), readBytes(name) -> Uint8Array | null. */
function loadExt(lib, readRecords, readBytes) {
    const code = readBytes('wram-code.bin'), state = readBytes('wram-code.state'), aram = readBytes('aram.cdl');
    mergeExt(lib, {
        rets: readRecords('rets.bin', 'EVRT', 3),
        regs: readRecords('regs.bin', 'EVRG', 2),
        bases: readRecords('bases.bin', 'EVBS', 3),
        wcode: code && state ? [{ index: 0, code: code.subarray(0, WRAM_SIZE), state: state.subarray(0, WRAM_SIZE) }] : [],
        aram: aram ? [{ index: 0, data: aram.subarray(0, ARAM_SIZE) }] : [],
    }, () => {});
}

/** Writers for flush(): name -> () => Buffer | Uint8Array. */
function extWriters(lib, packRecords) {
    return {
        'rets.bin': () => packRecords('EVRT', [...lib.rets].map(([k, f]) => {
            const mx = k % 16, rest = Math.floor(k / 16);
            return [Math.floor(rest / 0x1000000), rest % 0x1000000, (mx << 8) | f];
        }), 3),
        'regs.bin': () => packRecords('EVRG', [...lib.regs].map(k => [Math.floor(k / 0x100000), k % 0x100000]), 2),
        'bases.bin': () => packRecords('EVBS', [...lib.bases].map(([k, f]) => [Math.floor(k / 0x1000000), k % 0x1000000, f]), 3),
        'wram-code.bin': () => lib.wcode,
        'wram-code.state': () => lib.wcodeState,
        'aram.cdl': () => lib.aram,
    };
}

/** Decoded views for the exporters. */
function retsList(lib) {
    return [...lib.rets].map(([k, flags]) => {
        const mx = k % 16, rest = Math.floor(k / 16);
        return { entry: Math.floor(rest / 0x1000000), retPc: rest % 0x1000000, entryM8: !!(mx & 1), entryX8: !!(mx & 2), exitM8: !!(mx & 4), exitX8: !!(mx & 8), flags };
    });
}

/** pc -> { db: Set, d: Set, y: Set } */
function regsByPc(lib) {
    const out = new Map();
    for (const k of lib.regs) {
        const pc = Math.floor(k / 0x100000), kv = k % 0x100000, kind = kv >>> 16, v = kv & 0xFFFF;
        const r = out.get(pc) || out.set(pc, { db: new Set(), d: new Set(), y: new Set() }).get(pc);
        (kind === REG.DB ? r.db : kind === REG.D ? r.d : r.y).add(v);
    }
    return out;
}

/** pc -> [{ base, flags }] */
function basesByPc(lib) {
    const out = new Map();
    for (const [k, flags] of lib.bases) {
        const pc = Math.floor(k / 0x1000000);
        (out.get(pc) || out.set(pc, []).get(pc)).push({ base: k % 0x1000000, flags });
    }
    return out;
}

module.exports = {
    initExt, mergeExt, loadExt, extWriters, retsList, regsByPc, basesByPc,
    RET, REG, BASE, WCODE, ARAM, EXT_FILES: ['rets.bin', 'regs.bin', 'bases.bin', 'wram-code.bin', 'wram-code.state', 'aram.cdl'],
};
