'use strict';

/**
 * platform/cdl/recomp-analysis.js
 *
 * Recorded control flow -> snesrecomp cfg directives (grammar checked against
 * snesrecomp recompiler/v2/cfg_loader.py):
 *   exit widths   `func ... exit_mx:M,X` (one exit for every entry variant),
 *                 `exit_mx_variant <addr24> <em> <ex> <xm> <xx>`, `exit_mx_set <addr24> MmXn a,b`
 *   dispatch      `indirect_dispatch <site16> <n> idx:X`             JMP/JSR (abs,X) through a ROM table
 *                 `indirect_dispatch <site16> <n> ptrtail|ptrcall targets:...`  JMP (abs) / JML [abs]
 *                 `indirect_dispatch <pei16> <n> rtsstack targets:...`          PEI ; RTS
 *   WRAM code     `ram_routine <pc24> MmXn <hex>`
 * Everything else the recorder knows but snesrecomp has no directive for
 * (PHA/PEA + RTS dispatch, adjusted return addresses, frames that never
 * return) becomes a comment next to the site. 1 = 8-bit in every M/X field.
 */

const { hex } = require('../../../dist/platform/cdl/rom-map');
const { retsList, RET, WCODE } = require('./library-ext');
const { decodeAt } = require('../../../dist/platform/cdl/disasm');

const FLOW_INDIRECT = 8, FLOW_RETURN = 0x20;
const EXT_HEAD = 0x04;
const TABLE_SCAN = 256;
const CDL_CODE = 0x01, CDL_DATA = 0x02, SPACE_ROM = 1;

/** ROM offset -> Set of PCs that read it (recorded xrefs). */
function romReaders(lib) {
    const by = new Map();
    for (const key of lib.xrefs.keys()) {
        const pc = Math.floor(key / 0x4000000), sa = key % 0x4000000;
        if ((sa >>> 24) !== SPACE_ROM) continue;
        const off = sa & 0xFFFFFF;
        (by.get(off) || by.set(off, new Set()).get(off)).add(pc);
    }
    return by;
}

/**
 * Entries of a jmp/jsr (abs,X) table beyond the highest observed one. The CDL only knows the
 * entries that were taken while recording; a too-small count makes snesrecomp route the rest
 * through its interpreter fallback, which went wrong at SoE's $8F:9F46 (16 entries, 8 observed:
 * garbled title-screen sprites). Keep counting while an entry is a plausible same-bank code
 * pointer and the table bytes are not something else: never executed, not read by another
 * non-dispatch instruction (the next table), target not recorded as data only.
 */
function staticTableCount({ lib, rom, map, bank, base, observed, site, readers }) {
    let count = observed;
    for (let k = observed; k < TABLE_SCAN; k++) {
        const o = map.busToRom((bank << 16) | ((base + k * 2) & 0xFFFF));
        if (o < 0 || o + 1 >= rom.length) break;
        if ((lib.cdl[o] | lib.cdl[o + 1]) & CDL_CODE) break;
        // another jmp/jsr (abs,X) may share the table (SoE $8F:9ECA reads $8F:9F46's entries 8+); a plain
        // data read (lda $A3F8,x) marks the next table
        const other = pc => {
            if (pc === site) return false;
            const po = map.busToRom(pc);
            return !(po >= 0 && (rom[po] === 0x7C || rom[po] === 0xFC));
        };
        if ([...(readers.get(o) || [])].some(other) || [...(readers.get(o + 1) || [])].some(other)) break;
        const w = rom[o] | (rom[o + 1] << 8);
        const t = map.busToRom((bank << 16) | w);
        if (w < 0x8000 || t < 0) break;
        if ((lib.cdl[t] & CDL_DATA) && !(lib.cdl[t] & CDL_CODE)) break;
        if (t >= map.busToRom((bank << 16) | base) && t < o + 2) break;   // points into the table itself
        count = k + 1;
    }
    return count;
}
const RAM_ROUTINE_MAX = 0x400;

const mxName = (m8, x8) => 'M' + (m8 ? 1 : 0) + 'X' + (x8 ? 1 : 0);

/** entry bus -> { variants: Map('M1X1' -> Set(exit names)), normal, dropped: Set(site), modified: Set(retPc) } */
function returnsByEntry(lib) {
    const out = new Map();
    const get = e => out.get(e) || out.set(e, { variants: new Map(), normal: 0, dropped: new Set(), modified: new Set() }).get(e);
    for (const r of retsList(lib)) {
        if (r.flags & RET.INTERRUPT) continue;
        const f = get(r.entry);
        if (r.flags & RET.DROPPED) f.dropped.add(r.retPc);
        if (r.flags & (RET.NORMAL | RET.MODIFIED)) {
            f.normal++;
            const v = mxName(r.entryM8, r.entryX8);
            (f.variants.get(v) || f.variants.set(v, new Set()).get(v)).add(mxName(r.exitM8, r.exitX8));
        }
        if (r.flags & RET.MODIFIED) f.modified.add(r.retPc);
    }
    return out;
}

/** Inline exit_mx for a func line, plus standalone lines when variants differ. */
function exitDirectives(info, bus) {
    if (!info || !info.variants.size) return { inline: '', lines: [] };
    const all = new Set();
    for (const exits of info.variants.values()) exits.forEach(e => all.add(e));
    if (all.size === 1) {
        const e = [...all][0];
        return { inline: ` exit_mx:${e[1]},${e[3]}`, lines: [] };
    }
    const lines = [];
    const addr = hex(bus, 6).toLowerCase();
    for (const [entry, exits] of info.variants) {
        if (exits.size === 1) {
            const e = [...exits][0];
            lines.push(`exit_mx_variant ${addr} ${entry[1]} ${entry[3]} ${e[1]} ${e[3]}`);
        } else {
            lines.push(`exit_mx_set ${addr} ${entry} ${[...exits].sort().join(',')}`);
        }
    }
    return { inline: '', lines };
}

function head(rom, lib, off) {
    return off >= 0 && (lib.ext[off] & EXT_HEAD) ? decodeAt(rom, off, lib.cdl[off], lib.ext[off]) : null;
}

/** Previous instruction head before `off` (CDL heads only). */
function prevHead(rom, lib, off) {
    for (let p = off - 1; p >= off - 4 && p >= 0; p--) {
        const ins = head(rom, lib, p);
        if (ins && p + ins.len === off) return { off: p, ins };
    }
    return null;
}

// Sites where emitting an indirect_dispatch directive breaks runtime execution:
// - $8F:9F46 / $CF:9F46: JMP ($A3D8,x) inside func_CF9F05. Active loop with PHA/PLA stack usage at $A3B1.
//   snesrecomp emits a native tail call (RecompStackPop + return), causing native call stack frames
//   to desynchronize from the 65816 stack across iterations, corrupting WRAM $7E:ABDE (OAM) in Cycle 2.
// - $80:84BE / $00:84BE: JML [$0125] NMI dynamic hook called via PHK; PEA $84C0 (3-byte return frame, not 2).
//   Static target list misses dynamic hooks.
const DISPATCH_EXCLUSIONS = new Map([
    [0x8F9F46, 'stack-resident loop dispatcher in func_CF9F05; native RecompStackPop desynchronizes C stack across loop'],
    [0xCF9F46, 'stack-resident loop dispatcher in func_CF9F05; native RecompStackPop desynchronizes C stack across loop'],
    [0x8084BE, 'NMI dynamic hook JML [$0125] with 3-byte return frame (PHK; PEA) and dynamic targets'],
    [0x0084BE, 'NMI dynamic hook JML [$0125] with 3-byte return frame (PHK; PEA) and dynamic targets'],
]);

/**
 * Function entries excluded from being emitted as root `func` directives in recomp/cfg/bankXX.cfg.
 *
 * Why:
 * When related functions in a tight internal cluster (like the dynamic sprite allocator and direct OAM drawer)
 * are emitted as separate root `func` entries, snesrecomp's control flow analysis can either merge them into
 * a massive multi-entry mega-function or compile inter-routine JSLs with mismatched C/65816 stack frames.
 * When left to the LLE interpreter fallback, they execute coherently with exact 65816 stack pushes/pulls.
 *
 * Dropping the root is not enough on its own: snesrecomp rediscovers a routine as the JSL target of a compiled
 * caller and compiles it anyway, so recomp-seeds.js also emits `force_lle` for each of these. Without it
 * $90:D749 (effect sprites) called a compiled $80:9033 and corrupted the OBJ tile LRU lists at $7E9727 /
 * $7E96A5 within one fight, which handed out OBJ tile $81 and overwrote the HUD portrait (v0.201.19).
 *
 * Addresses in bank $80 (mirrored at $C0):
 * - $80960A / $C0960A: sprite VRAM block allocator (allocates blocks in $7E:50AD)
 * - $809685 / $C09685: sprite VRAM block free routine
 * - $8096BB / $C096BB: dynamic sprite queue consumer (sets up DP $02..$27 and calls JSL $809040)
 * - $809033 / $C09033: direct sprite draw routine (direct_sprite_draw_oam)
 * - $809040 / $C09040: direct sprite draw routine internal entry (called from 96bb)
 * - $808FEE / $C08FEE: dynamic sprite queue setup routine
 */
const FUNC_EXCLUSIONS = new Map([
    [0x80960A, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0xC0960A, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0x809685, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0xC09685, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0x8096BB, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0xC096BB, 'dynamic sprite allocator cluster; stack/register desync in snesrecomp mega-function corrupts OAM allocations'],
    [0x809033, 'dynamic sprite allocator cluster; direct_sprite_draw_oam; leaves stack frame intact for interpreter'],
    [0xC09033, 'dynamic sprite allocator cluster; direct_sprite_draw_oam; leaves stack frame intact for interpreter'],
    [0x809040, 'dynamic sprite allocator cluster; internal entry called from 96bb; leaves stack frame intact for interpreter'],
    [0xC09040, 'dynamic sprite allocator cluster; internal entry called from 96bb; leaves stack frame intact for interpreter'],
    [0x808FEE, 'dynamic sprite allocator cluster; sprite queue setup; leaves stack frame intact for interpreter'],
    [0xC08FEE, 'dynamic sprite allocator cluster; sprite queue setup; leaves stack frame intact for interpreter'],
]);

/**
 * Indirect sites: directive or comment per site, keyed by runtime bank.
 * @returns {{ lines: Map(bank -> string[]), counts: { indexed, pointer, rtsstack, comments } }}
 */
function dispatchDirectives({ lib, rom, map }) {
    const lines = new Map();
    const add = (bank, line) => (lines.get(bank) || lines.set(bank, []).get(bank)).push(line);
    const counts = { indexed: 0, pointer: 0, rtsstack: 0, comments: 0 };
    const sites = new Map(), returns = new Map();
    for (const [key, kind] of lib.edges) {
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        if (kind & 0x10) continue;
        if (kind & FLOW_INDIRECT) (sites.get(from) || sites.set(from, new Set()).get(from)).add(to);
        else if (kind & FLOW_RETURN) (returns.get(from) || returns.set(from, new Set()).get(from)).add(to);
    }
    const modifiedAt = new Set(retsList(lib).filter(r => r.flags & RET.MODIFIED).map(r => r.retPc));
    const t6 = v => hex(v, 6).toLowerCase(), t4 = v => hex(v & 0xFFFF, 4).toLowerCase();
    let readers = null;

    for (const [site, tos] of [...sites].sort((a, b) => a[0] - b[0])) {
        const bank = site >>> 16, off = map.busToRom(site), ins = head(rom, lib, off);
        const targets = [...tos].sort((a, b) => a - b);
        const seen = '(' + targets.length + ' observed: ' + targets.map(t6).join(',') + ')';
        if (DISPATCH_EXCLUSIONS.has(site)) {
            add(bank, `# indirect at ${t4(site)} ${seen}: excluded (${DISPATCH_EXCLUSIONS.get(site)})`);
            counts.comments++;
            continue;
        }
        if (!ins) { add(bank, `# indirect at ${t4(site)} ${seen}: site not decodable`); counts.comments++; continue; }
        if (ins.op === 0x7C || ins.op === 0xFC) {
            let count = 0;
            for (let k = 0; k < TABLE_SCAN; k++) {
                const o = map.busToRom((bank << 16) | ((ins.operand + k * 2) & 0xFFFF));
                if (o < 0 || o + 1 >= rom.length) break;
                if (tos.has((bank << 16) | rom[o] | (rom[o + 1] << 8))) count = k + 1;
            }
            if (count) {
                readers = readers || romReaders(lib);
                const total = staticTableCount({ lib, rom, map, bank, base: ins.operand, observed: count, site, readers });
                const why = total > count ? `${count} entries up to the highest observed target, ${total - count} more by static scan` : 'entries up to the highest observed target';
                add(bank, `indirect_dispatch ${t4(site)} ${total} idx:X    # ${ins.mnemonic.toLowerCase()} ($${hex(ins.operand, 4)},x), ${why} ${seen}`);
                counts.indexed++;
            } else {
                add(bank, `# indirect at ${t4(site)} ${seen}: no observed target found in the table at $${hex(ins.operand, 4)}`);
                counts.comments++;
            }
        } else if (ins.op === 0x6C || ins.op === 0xDC) {
            const long = ins.op === 0xDC;
            const list = targets.map(t => (long ? t6(t) : t4(t))).join(',');
            const prev = prevHead(rom, lib, off);
            const mode = prev && prev.ins.op === 0xF4
                ? `ptrcall return:${t4(prev.ins.operand + 1)} frame:2`
                : 'ptrtail';
            add(bank, `indirect_dispatch ${t4(site)} ${targets.length} ${mode} targets:${list}    # ${ins.mnemonic.toLowerCase()} through $${hex(ins.operand, 4)}, observed targets only`);
            counts.pointer++;
        } else {
            add(bank, `# indirect at ${t4(site)} ${seen}: ${ins.mnemonic.toLowerCase()} (no directive form)`);
            counts.comments++;
        }
    }

    for (const [rts, tos] of [...returns].sort((a, b) => a[0] - b[0])) {
        const bank = rts >>> 16, off = map.busToRom(rts);
        const targets = [...tos].sort((a, b) => a - b);
        if (modifiedAt.has(rts)) {
            add(bank, `# return address adjusted before ${t4(rts)} (inline data after the call?) -> ${targets.map(t6).join(',')}`);
            counts.comments++;
            continue;
        }
        const prev = off >= 0 ? prevHead(rom, lib, off) : null;
        if (prev && prev.ins.op === 0xD4) {
            const peiBus = (bank << 16) | ((rts - (off - prev.off)) & 0xFFFF);
            add(bank, `indirect_dispatch ${t4(peiBus)} ${targets.length} rtsstack targets:${targets.map(t6).join(',')}    # pei ; rts, observed targets only`);
            counts.rtsstack++;
        } else {
            add(bank, `# pushed-address return at ${t4(rts)} -> ${targets.map(t6).join(',')}  (PHA/PEA + RTS dispatch: no snesrecomp directive; consider hle_dispatch)`);
            counts.comments++;
        }
    }
    return { lines, counts };
}

/** Functions whose frames were unwound and that never returned normally. */
function noReturnComments(returns, labelOf) {
    const out = [];
    for (const [entry, info] of returns) {
        if (info.normal || !info.dropped.size) continue;
        out.push({ bank: entry >>> 16, line: `# ${labelOf(entry)} never returned normally; frames unwound from call sites ${[...info.dropped].map(s => hex(s & 0xFFFF, 4).toLowerCase()).join(',')} (noreturn_jsr / terminal_jsr candidate, check by hand)` });
    }
    return out;
}

/** WRAM routines reached by a call or jump, with their recorded bytes. */
function ramRoutines(lib, returns) {
    const out = [], skipped = [];
    const entries = new Set();
    for (const [key] of lib.edges) {
        const to = key % 0x1000000, bank = to >>> 16;
        if (bank === 0x7E || bank === 0x7F) entries.add(to - 0x7E0000);
        else if ((bank & 0x7F) < 0x40 && (to & 0xFFFF) < 0x2000) entries.add(to & 0xFFFF);
    }
    for (const w of [...entries].sort((a, b) => a - b)) {
        let end = w;
        let changed = false;
        while (end < 0x20000 && end - w < RAM_ROUTINE_MAX && (lib.wcodeState[end] & WCODE.SEEN)) {
            if (lib.wcodeState[end] & WCODE.CHANGED) changed = true;
            end++;
        }
        if (end === w) continue;
        const pc24 = 0x7E0000 + w;
        const info = returns.get(pc24) || returns.get(w) || null;
        const variant = info && info.variants.size ? [...info.variants.keys()][0] : null;
        if (changed || !variant) {
            skipped.push(`# WRAM code at ${hex(pc24, 6).toLowerCase()} (${end - w} bytes): ` + (changed ? 'executed with different bytes (self-modifying / reused buffer)' : 'entry M/X unknown (never returned normally)'));
            continue;
        }
        out.push(`ram_routine ${hex(pc24, 6).toLowerCase()} ${variant} ${Buffer.from(lib.wcode.subarray(w, end)).toString('hex').toUpperCase()}`);
    }
    return { lines: out, skipped };
}

module.exports = { returnsByEntry, exitDirectives, dispatchDirectives, noReturnComments, ramRoutines, staticTableCount, DISPATCH_EXCLUSIONS, FUNC_EXCLUSIONS };
