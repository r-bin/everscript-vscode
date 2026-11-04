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

import { hex } from './rom-map';
import type { RomMap } from './rom-map';
import type { CdlLibrary } from './library';
import { retsList, RET, WCODE } from './library-ext';
import { decodeAt } from './disasm';

const FLOW_INDIRECT = 8, FLOW_RETURN = 0x20;
const EXT_HEAD = 0x04;
const TABLE_SCAN = 256;
const CDL_CODE = 0x01, CDL_DATA = 0x02, SPACE_ROM = 1;

/** What returnsByEntry collects for one routine entry. */
interface ReturnInfo { variants: Map<string, Set<string>>; normal: number; dropped: Set<number>; modified: Set<number> }
type Readers = Map<number, Set<number>>;

/** ROM offset -> Set of PCs that read it (recorded xrefs). */
function romReaders(lib: CdlLibrary): Readers {
    const by: Readers = new Map();
    for (const key of lib.xrefs.keys()) {
        const pc = Math.floor(key / 0x4000000), sa = key % 0x4000000;
        if ((sa >>> 24) !== SPACE_ROM) continue;
        const off = sa & 0xFFFFFF;
        (by.get(off) || by.set(off, new Set()).get(off)!).add(pc);
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
function staticTableCount({ lib, rom, map, bank, base, observed, site, readers }: {
    lib: CdlLibrary; rom: Uint8Array; map: RomMap; bank: number; base: number; observed: number; site: number; readers: Readers;
}): number {
    let count = observed;
    for (let k = observed; k < TABLE_SCAN; k++) {
        const o = map.busToRom((bank << 16) | ((base + k * 2) & 0xFFFF));
        if (o < 0 || o + 1 >= rom.length) break;
        if ((lib.cdl[o] | lib.cdl[o + 1]) & CDL_CODE) break;
        // another jmp/jsr (abs,X) may share the table (SoE $8F:9ECA reads $8F:9F46's entries 8+); a plain
        // data read (lda $A3F8,x) marks the next table
        const other = (pc: number): boolean => {
            if (pc === site) return false;
            const po = map.busToRom(pc);
            return !(po >= 0 && (rom[po] === 0x7C || rom[po] === 0xFC));
        };
        if ([...(readers.get(o) || [])].some(other) || [...(readers.get(o + 1) || [])].some(other)) break;
        const w = rom[o] | (rom[o + 1] << 8);
        const t = map.busToRom((bank << 16) | w);
        if (w < 0x8000 || t < 0) break;
        // only targets the CDL saw run (from this site or another one sharing the table): a guessed entry gains
        // nothing (an index past the list runs on the interpreter) and one the analyzer cannot prove (entry $65 of the
        // animation VM table, knowledge routines/tbl_animation_vm_jump_table.md) keeps the dispatching routine interpreted
        if (!(lib.cdl[t] & CDL_CODE)) break;
        if (t >= map.busToRom((bank << 16) | base) && t < o + 2) break;   // points into the table itself
        count = k + 1;
    }
    return count;
}
const RAM_ROUTINE_MAX = 0x400;

const mxName = (m8: boolean, x8: boolean): string => 'M' + (m8 ? 1 : 0) + 'X' + (x8 ? 1 : 0);

/** entry bus -> { variants: Map('M1X1' -> Set(exit names)), normal, dropped: Set(site), modified: Set(retPc) } */
function returnsByEntry(lib: CdlLibrary): Map<number, ReturnInfo> {
    const out = new Map<number, ReturnInfo>();
    const get = (e: number): ReturnInfo => out.get(e) || out.set(e, { variants: new Map(), normal: 0, dropped: new Set(), modified: new Set() }).get(e)!;
    // A MODIFIED return went somewhere else than the call site (SoE $8C:EA43's one is an RTL in bank $90): its
    // widths are an exit width only for an entry variant with no NORMAL return. Counted as one, they gave
    // script_eval_expression an M1X0 exit the CDL never saw at a call site, and snesrecomp kept ~50 script
    // handlers that call it interpreted.
    const modifiedExits = new Map<number, Map<string, Set<string>>>();
    for (const r of retsList(lib)) {
        if (r.flags & RET.INTERRUPT) continue;
        const f = get(r.entry);
        if (r.flags & RET.DROPPED) f.dropped.add(r.retPc);
        const v = mxName(r.entryM8, r.entryX8), exit = mxName(r.exitM8, r.exitX8);
        if (r.flags & RET.NORMAL) {
            f.normal++;
            (f.variants.get(v) || f.variants.set(v, new Set()).get(v)!).add(exit);
        } else if (r.flags & RET.MODIFIED) {
            f.normal++;
            const m = modifiedExits.get(r.entry) || modifiedExits.set(r.entry, new Map()).get(r.entry)!;
            (m.get(v) || m.set(v, new Set()).get(v)!).add(exit);
        }
        if (r.flags & RET.MODIFIED) f.modified.add(r.retPc);
    }
    for (const [entry, byVariant] of modifiedExits) {
        const f = out.get(entry)!;
        for (const [v, exits] of byVariant) if (!f.variants.has(v)) f.variants.set(v, exits);
    }
    return out;
}

/** Inline exit_mx for a func line, plus standalone lines when variants differ. */
function exitDirectives(info: ReturnInfo | null | undefined, bus: number): { inline: string; lines: string[] } {
    if (!info || !info.variants.size) return { inline: '', lines: [] };
    const all = new Set<string>();
    for (const exits of info.variants.values()) exits.forEach(e => all.add(e));
    if (all.size === 1) {
        const e = [...all][0];
        return { inline: ` exit_mx:${e[1]},${e[3]}`, lines: [] };
    }
    const lines: string[] = [];
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

function head(rom: Uint8Array, lib: CdlLibrary, off: number) {
    return off >= 0 && (lib.ext[off] & EXT_HEAD) ? decodeAt(rom, off, lib.cdl[off], lib.ext[off]) : null;
}

/** Previous instruction head before `off` (CDL heads only). */
function prevHead(rom: Uint8Array, lib: CdlLibrary, off: number) {
    for (let p = off - 1; p >= off - 4 && p >= 0; p--) {
        const ins = head(rom, lib, p);
        if (ins && p + ins.len === off) return { off: p, ins };
    }
    return null;
}

/**
 * Directives the seeds must not emit, decided by the recomp project (its `recomp/seed-exclusions.txt`,
 * where each entry says why). One per line, `#` starts a comment:
 *   func <pc24> <reason>       no root `func` line, and `force_lle`: snesrecomp rediscovers a dropped root
 *                              as the target of a compiled caller and compiles it anyway, so only
 *                              force_lle keeps it interpreted for every caller
 *   dispatch <pc24> <reason>   no `indirect_dispatch` at this jump site
 * An address stands for all its HiROM mirrors ($00/$40/$80/$C0 banks).
 */
/** `hle`: routines the recomp replaces with C (`hle_func`), keyed by the runtime address, with the glue's function.
 *  `body`: the routine's second instruction, seeded as a root so the part after the first instruction stays compiled for
 *  the calls the C cannot take (`hle_func` replaces only the entry). */
interface RecompExclusions { func: Map<number, string>; dispatch: Map<number, string>; hle: Map<number, { fn: string; body?: number; reason: string }> }

function parseExclusions(text: string): RecompExclusions {
    const out: RecompExclusions = { func: new Map(), dispatch: new Map(), hle: new Map() };
    text.split('\n').forEach((raw, i) => {
        const line = raw.replace(/#.*/, '').trim();
        if (!line) return;
        const h = /^hle\s+\$?([0-9a-fA-F]{6})\s+([A-Za-z_]\w*)\s+(?:body=\$?([0-9a-fA-F]{6})\s+)?(.+)$/.exec(line);
        if (h) { out.hle.set(parseInt(h[1], 16), { fn: h[2], ...(h[3] ? { body: parseInt(h[3], 16) } : {}), reason: h[4].trim() }); return; }
        const m = /^(func|dispatch)\s+\$?([0-9a-fA-F]{6})\s+(.+)$/.exec(line);
        if (!m) throw new Error(`seed exclusions line ${i + 1}: expected "func|dispatch <pc24> <reason>" or "hle <pc24> <c_function> [body=<pc24>] <reason>": ${raw}`);
        const pc = parseInt(m[2], 16) & 0x3FFFFF;
        for (const bank of [0x000000, 0x400000, 0x800000, 0xC00000]) out[m[1] as 'func' | 'dispatch'].set((pc | bank) >>> 0, m[3].trim());
    });
    return out;
}

const NO_EXCLUSIONS: RecompExclusions = { func: new Map(), dispatch: new Map(), hle: new Map() };

/**
 * Indirect sites: directive or comment per site, keyed by runtime bank.
 * @returns {{ lines: Map(bank -> string[]), counts: { indexed, pointer, rtsstack, comments } }}
 */
function dispatchDirectives({ lib, rom, map, exclusions = NO_EXCLUSIONS }: { lib: CdlLibrary; rom: Uint8Array; map: RomMap; exclusions?: RecompExclusions }) {
    const lines = new Map<number, string[]>();
    const add = (bank: number, line: string) => (lines.get(bank) || lines.set(bank, []).get(bank)!).push(line);
    const counts = { indexed: 0, pointer: 0, rtsstack: 0, comments: 0 };
    const sites = new Map<number, Set<number>>(), returns = new Map<number, Set<number>>();
    for (const [key, kind] of lib.edges) {
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        if (kind & 0x10) continue;
        if (kind & FLOW_INDIRECT) (sites.get(from) || sites.set(from, new Set()).get(from)!).add(to);
        else if (kind & FLOW_RETURN) (returns.get(from) || returns.set(from, new Set()).get(from)!).add(to);
    }
    const modifiedAt = new Set(retsList(lib).filter(r => r.flags & RET.MODIFIED).map(r => r.retPc));
    const t6 = (v: number) => hex(v, 6).toLowerCase(), t4 = (v: number) => hex(v & 0xFFFF, 4).toLowerCase();
    let readers: Readers | null = null;

    for (const [site, tos] of [...sites].sort((a, b) => a[0] - b[0])) {
        const bank = site >>> 16, off = map.busToRom(site), ins = head(rom, lib, off);
        const targets = [...tos].sort((a, b) => a - b);
        const seen = '(' + targets.length + ' observed: ' + targets.map(t6).join(',') + ')';
        if (exclusions.dispatch.has(site)) {
            add(bank, `# indirect at ${t4(site)} ${seen}: excluded (${exclusions.dispatch.get(site)})`);
            counts.comments++;
            continue;
        }
        if (!ins) { add(bank, `# indirect at ${t4(site)} ${seen}: site not decodable`); counts.comments++; continue; }
        if (ins.op === 0x7C || ins.op === 0xFC) {
            let count = 0;
            for (let k = 0; k < TABLE_SCAN; k++) {
                const o = map.busToRom((bank << 16) | ((ins.operand + k * 2) & 0xFFFF));
                if (o < 0 || o + 1 >= rom.length) break;
                // the table ends where its bytes ran as code: a later word equal to an observed target is a
                // coincidence ($8F:C3FF has 8 handlers, then code; its word 105 matched one and made 106, whose
                // garbage entries became interpreter-only "routines"). Words below $8000 are holes, not the end.
                if ((lib.cdl[o] | lib.cdl[o + 1]) & CDL_CODE) break;
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
            // PEA <ret-1> pushes 2 bytes; a PHK before it makes the 3-byte frame its target's RTL pops.
            const phk = prev && prev.ins.op === 0xF4 && prevHead(rom, lib, prev.off)?.ins.op === 0x4B;
            const mode = prev && prev.ins.op === 0xF4
                ? `ptrcall return:${t4(prev.ins.operand + 1)} frame:${phk ? 3 : 2}`
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
function noReturnComments(returns: Map<number, ReturnInfo>, labelOf: (entry: number) => string) {
    const out: { bank: number; line: string }[] = [];
    for (const [entry, info] of returns) {
        if (info.normal || !info.dropped.size) continue;
        out.push({ bank: entry >>> 16, line: `# ${labelOf(entry)} never returned normally; frames unwound from call sites ${[...info.dropped].map(s => hex(s & 0xFFFF, 4).toLowerCase()).join(',')} (noreturn_jsr / terminal_jsr candidate, check by hand)` });
    }
    return out;
}

/** WRAM routines reached by a call or jump, with their recorded bytes. */
function ramRoutines(lib: CdlLibrary, returns: Map<number, ReturnInfo>) {
    const out: string[] = [], skipped: string[] = [];
    const entries = new Set<number>();
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

/**
 * Assertion traps: a BRK that a recorded conditional branch jumps to and that never ran (`BMI fail` ... `fail: BRK
 * #$A6`, SoE $8F:9E76). snesrecomp marks a routine that decodes a BRK as structural poison and keeps it
 * interpreted; a BRK byte declared `authority_data` and reached from a conditional branch is a trap instead (the
 * interpreter runs it if it is ever reached) and the routine compiles. Only $8000-$FFFF halves (the $80-bank
 * mirrors the seeds use); the analyzer adds the other mirror itself.
 */
function brkTraps({ lib, rom }: { lib: CdlLibrary; rom: Uint8Array }): Map<number, string[]> {
    const out = new Map<number, string[]>();
    const seen = new Set<number>();
    const n = Math.min(rom.length, lib.cdl.length, 0x400000);
    for (let off = 0; off + 1 < n; off++) {
        if (!(lib.cdl[off] & CDL_CODE) || !(lib.ext[off] & EXT_HEAD)) continue;
        const op = rom[off];
        if ((op & 0x1F) !== 0x10) continue;   // BPL BMI BVC BVS BCC BCS BNE BEQ
        const t = off + 2 + ((rom[off + 1] << 24) >> 24);
        if ((t >> 16) !== (off >> 16) || (t & 0xFFFF) < 0x8000 || t >= n || seen.has(t)) continue;
        if (rom[t] !== 0x00 || (lib.cdl[t] & CDL_CODE)) continue;
        seen.add(t);
        const bank = 0x80 | (t >>> 16), pc = t & 0xFFFF;
        (out.get(bank) || out.set(bank, []).get(bank)!).push(
            `authority_data ${hex(pc, 4).toLowerCase()} ${hex(pc + 1, 4).toLowerCase()}    # BRK #$${hex(rom[t + 1], 2)}: assertion trap behind the branch at $${hex(bank, 2)}:${hex(off & 0xFFFF, 4)}, never run`);
    }
    return out;
}

export { returnsByEntry, exitDirectives, dispatchDirectives, noReturnComments, ramRoutines, staticTableCount, parseExclusions, brkTraps, NO_EXCLUSIONS };
export type { RecompExclusions };
