// Symbolic operands and C3 movability analysis for `code` (docs/open-evermore/code.md §3.1, §4, §5).
// Maps WRAM census sites and generated-table `lda.l` readers to Asar symbol expressions, subtracts owned operand
// spans from foreign holes, and identifies pure `jsl`-only leaves safe to relocate in FastROM.
import { createRequire } from 'node:module';
import type { Span } from '../../codec.mts';
import type { Tree } from '../../tree.mts';
import { readText } from '../../tree.mts';
import { resourceSymbol } from '../../asar-project.mts';
import * as map from '../map.mts';
import { census } from './wram-moves.mts';
import { wramSymbolForVanilla } from './wram.mts';

const require = createRequire(import.meta.url);
const asm = require('../../../../dist/platform/snes/asm65816');
type Measured = ReturnType<typeof asm.measure>;

export interface Foreign extends Span { kind: string }
export interface TableSite { expr: string; kind: string; operandAt: number }
export interface WramSite { expr: string; operandAt: number; length: number }

const RUN = 0x800000;
const BANK = 0x10000;

interface ReaderSpec { kind: string; mapKey: string; tableKey: string; subHeader?: string }
const TABLE_READER_SPECS: ReaderSpec[] = [
    { kind: 'maps', mapKey: 'maps.table_readers', tableKey: 'maps/_map_table' },
    { kind: 'maps', mapKey: 'maps.enter_table_readers', tableKey: 'maps/_enter_table' },
    { kind: 'tiles', mapKey: 'tiles.table_readers', tableKey: 'tiles/_table' },
    { kind: 'scripts', mapKey: 'scripts.table_readers', tableKey: 'scripts/_table', subHeader: 'scripts.header' },
    { kind: 'animations', mapKey: 'animations.animate_readers', tableKey: 'animations/_table' },
    { kind: 'characters', mapKey: 'characters.enemy_index_readers', tableKey: 'characters/_enemy_index' },
    { kind: 'sprite_blocks_16', mapKey: 'sprite_blocks_16.table_readers', tableKey: 'sprite_blocks_16/_table' },
    { kind: 'sprite_blocks_8', mapKey: 'sprite_blocks_8.table_readers', tableKey: 'sprite_blocks_8/_table' },
];

const formatDeltaExpr = (sym: string, delta: number): string => {
    if (delta === 0) return sym;
    if (delta > 0) return `${sym}+$${delta.toString(16).toUpperCase()}`;
    return `${sym}-$${(-delta).toString(16).toUpperCase().padStart(4, '0')}`;
};

/** Instruction file offsets for generated-table `lda.l` readers whose kinds are active. */
export function tableReaderAt(presentKinds: Set<string>, romOrBase?: Uint8Array): Map<number, TableSite> {
    const out = new Map<number, TableSite>();
    for (const spec of TABLE_READER_SPECS) {
        if (!presentKinds.has(spec.kind)) continue;
        let sub = 0;
        if (spec.subHeader && romOrBase) {
            const off = map.file(spec.subHeader);
            if (off + 1 < romOrBase.length) sub = romOrBase[off] | (romOrBase[off + 1] << 8);
        }
        const sym = resourceSymbol(spec.tableKey);
        for (const r of map.readers(spec.mapKey)) {
            out.set(r.at - 1, { expr: formatDeltaExpr(sym, r.add - sub), kind: spec.kind, operandAt: r.at });
        }
    }
    return out;
}

/** Instruction offsets that `explode` reads in-place on round-trip (`tableAt` / `records.check`) and must stay pinned. */
export function allTableReaderInsOffsets(): Set<number> {
    const out = new Set<number>();
    for (const spec of TABLE_READER_SPECS) {
        for (const r of map.readers(spec.mapKey)) out.add(r.at - 1);
    }
    for (const key of ['experience.boy_readers', 'experience.dog_readers']) {
        for (const r of map.readers(key)) out.add(r.at - 1);
    }
    return out;
}

/** WRAM census instruction offsets mapped to their current symbolic WRAM expressions. */
export function wramSiteAt(): Map<number, WramSite> {
    const out = new Map<number, WramSite>();
    for (const g of census().groups) {
        for (const s of g.sites) {
            const expr = wramSymbolForVanilla(g.from + s.offset, s.length as 2 | 3, s.bank);
            if (expr) out.set(s.file, { expr, operandAt: s.file + 1, length: s.length });
        }
    }
    return out;
}

/** Operand byte spans owned by `code` (removed from other kinds' foreign holes). */
export function ownedSiteSpans(presentKinds: Set<string>, romOrBase?: Uint8Array): Foreign[] {
    const out: Foreign[] = [];
    for (const t of tableReaderAt(presentKinds, romOrBase).values()) {
        out.push({ start: t.operandAt, end: t.operandAt + 3, kind: t.kind });
    }
    if (presentKinds.has('wram')) {
        for (const w of wramSiteAt().values()) out.push({ start: w.operandAt, end: w.operandAt + w.length, kind: 'wram' });
    }
    return out;
}

/** Subtracts `owned` spans from sorted disjoint `foreign` spans. */
export function subtractSpans(foreign: Foreign[], owned: Span[]): Foreign[] {
    if (!owned.length) return foreign;
    const sorted = [...owned].sort((a, b) => a.start - b.start);
    const out: Foreign[] = [];
    for (const f of foreign) {
        let cur = f.start;
        for (const o of sorted) {
            if (o.end <= cur) continue;
            if (o.start >= f.end) break;
            if (o.start > cur) out.push({ start: cur, end: o.start, kind: f.kind });
            cur = Math.max(cur, o.end);
        }
        if (cur < f.end) out.push({ start: cur, end: f.end, kind: f.kind });
    }
    return out;
}

const TERMINATORS = new Set([0x60, 0x6B, 0x40, 0x4C, 0x5C, 0x6C, 0x7C, 0xDC, 0x80, 0x82, 0x00, 0xDB]);
const HAZARDS = new Set([0x4B, 0xF4, 0x62, 0x00, 0x02, 0xDB]); // phk, pea, per, brk, cop, stp

function handlerTargetsFromTree(tree: Tree): Set<string> {
    const out = new Set<string>();
    const prefixes = ['scripts/opcodes/', 'scripts/entities/', 'characters/attack_procs/', 'characters/behaviours/', 'animations/modes/', 'menus/'];
    for (const [path, bytes] of tree) {
        if (!path.endsWith('.json') || !prefixes.some(p => path.startsWith(p))) continue;
        try {
            const j = JSON.parse(readText(bytes));
            if (typeof j?.handler === 'string') out.add(j.handler);
            if (Array.isArray(j?.handlers)) for (const h of j.handlers) if (typeof h === 'string') out.add(h);
        } catch { /* ignore invalid JSON here; owning codec reports it */ }
    }
    return out;
}

function hasBytes(haystack: Uint8Array, needle: number[], from = 0, to = haystack.length): boolean {
    const end = to - needle.length;
    outer: for (let i = from; i <= end; i++) {
        for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
        return true;
    }
    return false;
}

/**
 * C3: identifies vanilla routines safe to relocate freely in FastROM: `jsl`-only leaves with no foreign holes,
 * no table-reader sites, no handler/vector references, no mid-entries, no `phk`/`pea`/`per`/data/near exits,
 * and whose vanilla address does not appear in `_base/unexploded.bin`.
 */
export function findMovableRoutines(
    measured: Map<string, Measured>,
    homes: Map<string, { at: number; length: number }>,
    foreignHoles: Map<string, Span[]>,
    baseImage: Uint8Array,
    tree: Tree,
): Set<string> {
    const labelOwner = new Map<string, string>();
    for (const [name, m] of measured) {
        for (const lbl of (m.labels as Map<string, number>).keys()) labelOwner.set(lbl, name);
    }

    const pinned = handlerTargetsFromTree(tree);
    const readerIns = allTableReaderInsOffsets();
    const byHome = new Map<number, string>();
    for (const [name] of measured) {
        const h = homes.get(`code/${name}`);
        if (h) byHome.set(h.at, name);
    }
    // Pin hardware vector targets ($00:FFE4-$00:FFFF).
    for (let v = 0xFFE4; v < 0x10000 && v + 1 < baseImage.length; v += 2) {
        const addr = baseImage[v] | (baseImage[v + 1] << 8);
        if (addr >= 0x8000) { const r = byHome.get(addr); if (r) pinned.add(r); }
    }
    // Pin routines that contain or install WRAM indirect-jump hook targets (e.g. `jml [$0125]`, `jml [$012B]`).
    const hookWriters = new Set(['NMI_USER_HOOK_FAR_PTR', 'IRQ_USER_HOOK_FAR_PTR']);
    for (const m of measured.values()) {
        for (const st of m.statements) {
            if (st.kind === 'ins' && st.mode === 'ilabs' && st.operand) {
                const tok = st.operand.trim();
                hookWriters.add(tok);
            }
        }
    }
    const hookImms = new Set<number>();
    for (const [caller, m] of measured) {
        const touchesHook = (m.statements as { kind: string; operand?: string }[]).some(st =>
            st.kind === 'ins' && st.operand && [...hookWriters].some(w => st.operand!.includes(w)),
        );
        if (!touchesHook) continue;
        pinned.add(caller);
        for (const st of m.statements as { kind: string; mode?: string; length: number; operand?: string }[]) {
            if (st.kind === 'ins' && (st.mode === 'immM' || st.mode === 'immX') && st.length === 3) {
                const mm = /^\$([0-9A-Fa-f]{4})$/.exec(st.operand?.trim() ?? '');
                if (mm) hookImms.add(parseInt(mm[1], 16));
            }
        }
    }
    for (const [name] of measured) {
        const h = homes.get(`code/${name}`);
        if (!h) continue;
        const lo = h.at & 0xFFFF, hi = lo + h.length;
        for (const imm of hookImms) if (imm >= lo && imm < hi) pinned.add(name);
    }

    const extJslCallers = new Set<string>();
    for (const [caller, m] of measured) {
        for (const st of m.statements) {
            const exprs = st.kind === 'data' ? (st.values ?? []) : [st.operand ?? '', st.operand2 ?? ''];
            for (const expr of exprs) {
                for (const tok of expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
                    const owner = labelOwner.get(tok);
                    if (!owner || owner === caller) continue;
                    const isJsl = st.kind === 'ins' && (st.op === 0x22 || st.op === 0x5C) && st.operand?.trim() === owner;
                    if (isJsl) extJslCallers.add(owner);
                    else pinned.add(owner);
                }
            }
        }
    }

    // Order vanilla routines by home address to check fall-through across adjacent routines.
    const ordered = [...measured.keys()]
        .map(name => ({ name, home: homes.get(`code/${name}`) }))
        .filter((x): x is { name: string; home: { at: number; length: number } } => !!x.home)
        .sort((a, b) => a.home.at - b.home.at);

    const movable = new Set<string>();
    let prevEnd = -1, prevTerminates = true;
    for (const { name, home } of ordered) {
        const m = measured.get(name)!;
        const stmts = (m.statements as { kind: string; op?: number; mode?: string; offset: number; operand?: string }[]).filter(s => s.kind !== 'org');
        const last = stmts[stmts.length - 1];
        const fallsIn = prevEnd === home.at && !prevTerminates;
        prevEnd = home.at + home.length;
        prevTerminates = !!(last?.kind === 'ins' && last.op !== undefined && TERMINATORS.has(last.op));

        if (fallsIn || pinned.has(name) || !extJslCallers.has(name)) continue;
        if ((foreignHoles.get(name)?.length ?? 0) > 0) continue;
        if (!last || last.kind !== 'ins' || (last.op !== 0x6B && last.op !== 0x5C)) continue;

        let ok = true;
        const ownLabels = m.labels as Map<string, number>;
        for (const st of stmts) {
            if (st.kind !== 'ins') { ok = false; break; }
            if (readerIns.has(home.at + st.offset)) { ok = false; break; }
            if (st.op !== undefined && HAZARDS.has(st.op)) { ok = false; break; }
            if (st.mode === 'iabs' || st.mode === 'iabsx' || st.mode === 'ilabs') { ok = false; break; }
            const isNearFlow = st.mode === 'rel8' || st.mode === 'rel16' || (st.mode === 'abs' && (st.op === 0x20 || st.op === 0x4C));
            if (isNearFlow) {
                const target = st.operand?.trim() ?? '';
                if (!ownLabels.has(target)) { ok = false; break; }
            }
        }
        if (!ok) continue;

        // Exclude if its FastROM/SlowROM 24-bit address or bank-local 16-bit address appears in `_base/unexploded.bin`.
        const run = RUN + home.at, bankStart = home.at & ~(BANK - 1);
        const lo = run & 0xFF, hi = (run >> 8) & 0xFF, bankFast = run >> 16, bankSlow = (0xC00000 + home.at) >> 16;
        if (hasBytes(baseImage, [lo, hi, bankFast]) || hasBytes(baseImage, [lo, hi, bankSlow])) continue;
        if (hasBytes(baseImage, [lo, hi], bankStart, Math.min(bankStart + BANK, baseImage.length))) continue;
        movable.add(name);
    }
    return movable;
}
