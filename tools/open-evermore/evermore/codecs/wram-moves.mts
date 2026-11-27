// The wram kind's moves (docs/open-evermore/wram.md §0.2): the reader census (which vanilla places can move and the
// operands that reach them, evermore/map/<release>.wram-readers.json), the checks of a layout against vanilla, and a
// ROM's places read back from its operands.
import type { ImplodeContext, Span } from '../../codec.mts';
import * as map from '../map.mts';
import { WRAM_END, WRAM_START, at16, partAt, partsOf, vanillaWram } from './wram-vars.mts';
import type { Variable } from './wram-vars.mts';

const DIR = 'wram', KIND = 'wram';

// ── the reader census: which vanilla places can move, and the operands that reach them ──
export interface Site { file: number; length: number; offset: number; width: number; bank?: number }
export interface Group { from: number; to: number; sites: Site[] }
export interface Census { groups: Group[]; pinned: { from: number; to: number; why: string }[]; capped: { pc: string; lo: number; hi: number }[] }
const busOfText = (t: string) => parseInt(t.replace(/[$:]/g, ''), 16);
let censusCache: Census | null = null;
/** The checked-in census of this release; empty (nothing moves) when the release has none. */
export function census(): Census {
    if (censusCache) return censusCache;
    const raw = map.wramCensus() as any, place = (k: string) => { const [a, n] = k.split('+'); const from = busOfText(a); return { from, to: from + Number(n) }; };
    if (!raw) return censusCache = { groups: [], pinned: [], capped: [] };
    const groups = Object.entries(raw.movable as Record<string, any[]>).map(([k, sites]) => ({ ...place(k), sites: sites.map(([pc, length, offset, width, bank]) => ({ file: busOfText(pc) & 0x3FFFFF, length, offset, width, ...(bank !== undefined ? { bank } : {}) })) }));
    const pinned = Object.entries(raw.pinned as Record<string, string>).map(([k, why]) => ({ ...place(k), why }));
    const capped = (raw.capped as [string, string, string][]).map(([pc, lo, hi]) => ({ pc, lo: busOfText(lo), hi: busOfText(hi) }));
    return censusCache = { groups: groups.sort((a, b) => a.from - b.from), pinned, capped };
}
/** Each site's operand bytes: the table space this kind generates. */
export const siteSpans = (): Span[] => census().groups.flatMap(g => g.sites.map(s => ({ start: s.file + 1, end: s.file + 1 + s.length })));
/** Where a group's first site says it starts, in `rom` (null when the site does not name WRAM). */
export function groupStart(rom: Uint8Array, g: Group): number | null {
    const starts = g.sites.map(s => {
        let v = 0;
        for (let k = s.length - 1; k >= 0; k--) v = v * 256 + rom[s.file + 1 + k];
        const bank = s.length === 3 ? v >> 16 : g.from >> 16;
        const at = (bank === 0x7E || bank === 0x7F ? bank << 16 : WRAM_START) | (v & 0xFFFF);
        return at - s.offset;
    });
    return starts.every(x => x === starts[0]) ? starts[0] : null;
}

export const regionOf = (at: number) => map.memory('wram').find(r => r.from <= at && at < r.to)!;
/** Whether the engine reaches [at, end) the way it reaches the home region (its `reach`). */
export function reaches(home: map.Region, at: number, end: number): boolean {
    switch (home.reach) {
        case 'direct': return end <= WRAM_START + 0x100;
        case 'mirror': return end <= WRAM_START + 0x2000;
        case 'bank': return at >> 16 === home.from >> 16 && (end - 1) >> 16 === home.from >> 16;
        case 'long': return at >= WRAM_START && end <= WRAM_END;
    }
}
export const savedBlock = (at: number, end: number): { from: number; to: number } | null | undefined => {
    for (const r of map.memory('wram')) for (const b of r.saved) { if (at >= b.from && end <= b.to) return b; if (at < b.to && end > b.from) return undefined; }
    return null;
};

/** What implode needs once the tree is read: every vanilla top variable's place in the build. */
export interface Moved { home: Variable; now: Variable | null }

/** The checks of a layout against vanilla: what moved or resized, and whether the census lets it. */
export function check(ctx: ImplodeContext, list: Variable[]): Moved[] {
    const f = ctx.findings, file = (v: Variable) => `${DIR}/${v.part ?? KIND}.json`;
    const byHome = new Map(list.filter(v => v.home).map(v => [v.home!, v]));
    const moves: Moved[] = vanillaWram().filter(v => !v.in).map(home => ({ home, now: byHome.get(home) ?? null }));
    const { groups, pinned, capped } = census();
    const inRange = (v: Variable, r: { from: number; to: number }) => v.at >= r.from && v.at < r.to;
    const pinOf = (v: Variable) => pinned.find(p => inRange(v, p));
    const groupOf = (v: Variable) => groups.find(g => inRange(v, g));
    const covers = (lo: number, hi: number) => capped.filter(c => c.lo < hi && c.hi >= lo).map(c => c.pc).join(' ');
    let unreachedMoved = 0;
    for (const { home, now } of moves) {
        const g = groupOf(home), pin = pinOf(home);
        if (!now) {
            if (g || pin) f.error('wram-removed', `${DIR}/${partAt(home.at)?.name ?? KIND}.json`, '', `${home.name} (${at16(home.at)}) is gone, but the game still reaches it (${pin?.why ?? 'it is in the reader census'}): keep it, or rename it`);
            continue;
        }
        const delta = now.at - home.at, resized = now.size !== home.size, end = now.at + (now.size ?? 0);
        const region = regionOf(home.at);
        if (delta || resized) {
            if (!reaches(region, now.at, Math.max(end, now.at + 1))) f.error('wram-reach', file(now), '', `${now.name} → ${at16(now.at)}: the engine reaches region ${region.name}'s variables ${region.reach === 'mirror' ? 'through the low mirror ($0000-$1FFF)' : region.reach === 'bank' ? `with the data bank $${(region.from >> 16).toString(16).toUpperCase()}` : region.reach === 'direct' ? 'on the direct page' : 'long'}, not there (${region.why})`);
            const was = savedBlock(home.at, home.at + (home.size ?? 1)), is = savedBlock(now.at, now.at + Math.max(now.size ?? 1, 1));
            if (was !== is && !(was === null && is === null)) f.error('wram-save-block', file(now), '', `${now.name} → ${at16(now.at)}: ${was ? `it is saved (block ${at16(was.from)}-${at16(was.to - 1)}) and must stay in that block` : 'it would land in a saved block'}: the save format does not move yet (W8)`);
        }
        if (pin) {
            if (delta) f.error('wram-pinned', file(now), '', `${now.name} cannot move (${at16(home.at)} → ${at16(now.at)}): ${pin.why}`);
            else if (resized && (now.size ?? 0) < (home.size ?? 0)) f.error('wram-resized', file(now), '', `${now.name} shrinks to ${now.size ?? '?'} bytes (vanilla ${home.size}): code no census can rewrite reaches it (${pin.why})`);
            continue;
        }
        if (!g) { if (delta) unreachedMoved++; continue; }
        // A group moves rigidly: every member by the same distance, none resized unless it is the group alone.
        const members = moves.filter(m => groupOf(m.home) === g);
        if (members.some(m => !m.now || m.now.at - m.home.at !== delta)) { if (members[0].home === home) f.error('wram-group-split', file(now), '', `${members.map(m => m.home.name).join(', ')} are reached by the same instructions (${at16(g.from)}-${at16(g.to - 1)}) and move together: give them one distance`); continue; }
        if (resized) {
            if (members.length > 1) { f.error('wram-resized', file(now), '', `${now.name} is one of ${members.length} variables reached together (${at16(g.from)}-${at16(g.to - 1)}): resize the group's last one, or none`); continue; }
            const past = g.sites.find(s => s.offset + s.width > (now.size ?? 0));
            if (past) { f.error('wram-resized', file(now), '', `${now.name} shrinks to ${now.size ?? 0} bytes, but an instruction reaches ${past.offset + past.width} of it`); continue; }
        }
        if (delta && members[0].home === home) {
            const was = covers(g.from - WRAM_START, g.to - 1 - WRAM_START), is = covers(g.from + delta - WRAM_START, g.to - 1 + delta - WRAM_START);
            if (was !== is) f.error('wram-block-routine', file(now), '', `${now.name} → ${at16(now.at)}: the block routines that reach it change (${was || 'none'} → ${is || 'none'}): a clear or copy would miss it or hit it`);
        }
    }
    // A new variable (no vanilla one is it): where its part's region is reached, and outside the saved blocks.
    for (const v of list) if (!v.home && !v.in && v.part) {
        const region = partsOf().find(p => p.name === v.part)!.region, end = v.at + Math.max(v.size ?? 1, 1);
        if (!reaches(region, v.at, end)) f.error('wram-reach', file(v), '', `${v.name} lands at ${at16(v.at)}, where region ${region.name}'s variables are not reached (${region.reach})`);
        if (savedBlock(v.at, end) !== null) f.error('wram-save-block', file(v), '', `${v.name} (new) lands in a saved block at ${at16(v.at)}: the save format does not grow yet (W8)`);
    }
    if (unreachedMoved) f.info('wram-unreached', `${DIR}/`, '', `${unreachedMoved} variable${unreachedMoved === 1 ? '' : 's'} no recorded play reached moved (nothing known reads them)`);
    return moves;
}

/** The variables of a ROM read without its tree (explode takes only the clean base ROM, so this is a round trip whose places
 *  differ from the tree's: the diff then shows where): each movable group where its operands say, pinned ones at home,
 *  and the ones no play reached (the ROM does not say where they are) in vanilla's order after the item before them, as
 *  long as room is left before the next placed one (a pad that lost bytes comes back shorter, one with none is gone).
 *  A variable that grew comes back at its vanilla size, the rest of it a gap. */
export function fromRom(vanilla: Variable[], deltas: Map<Group, number>): Variable[] {
    const tops = vanilla.filter(v => !v.in), groups = census().groups, pinned = census().pinned;
    const known = (v: Variable): number | null => {
        for (const [g, d] of deltas) if (v.at >= g.from && v.at < g.to) return v.at + d;
        return groups.some(g => v.at >= g.from && v.at < g.to) || pinned.some(p => v.at >= p.from && v.at < p.to) ? v.at : null;
    };
    const fixed = tops.map(known), out = new Map<Variable, Variable>();
    let cursor = WRAM_START, prevHome: Variable | null = null;
    tops.forEach((v, k) => {
        if (prevHome && prevHome.at >> 16 !== v.at >> 16) cursor = v.at & 0xFF0000;
        const gap = prevHome ? Math.max(0, v.at - (prevHome.at + (prevHome.size ?? 0))) : v.at - cursor;
        let at = fixed[k] ?? cursor + gap, size = v.size;
        if (fixed[k] === null) {
            const next = fixed.slice(k + 1).find(x => x !== null) ?? WRAM_END;
            if (size !== null && at + size > next) size = next - at;
            if (size !== null && size <= 0) { prevHome = v; return; }
        }
        out.set(v, { ...v, at, size, home: v });
        cursor = Math.max(cursor, at + (size ?? 0));
        prevHome = v;
    });
    return vanilla.flatMap(v => {
        if (!v.in) return out.has(v) ? [out.get(v)!] : [];
        const parent = vanilla.find(p => p.name === v.in)!, moved = out.get(parent);
        return moved && v.offset! + (v.size ?? 1) <= Math.max(moved.size ?? 1, 1) ? [{ ...v, at: moved.at + v.offset!, home: v }] : [];
    });
}
