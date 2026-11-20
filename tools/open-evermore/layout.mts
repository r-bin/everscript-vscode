// The allocator (docs/open-evermore/tool.md §3 step 4). Two modes:
//   stable          every item at its home (where explode found it) if it still fits its old footprint; the rest
//                   first fit.
//                   An unchanged tree therefore gives the original bytes (G0).
//   random(seed)    proves that nothing reaches an item by a fixed address: items are shuffled inside the span
//                   they came from, among the neighbours that share their rule, and (when there is other free space)
//                   half of them move out of it. Same seed, same layout. Game-neutral: SNES banks only.
import type { Home } from './base.mts';
import type { Item, Rule, Span, Window } from './codec.mts';

const BANK = 0x10000, HALF = 0x8000;
const ruleKey = (r: Rule) => `${!!r.upperHalf}/${!!r.lowerHalf}/${!!r.noCrossBank}/${r.maxSize ?? ''}/${r.below ?? ''}/${r.above ?? ''}/${r.bankOffset ?? ''}/${r.window ? r.window.from + '-' + r.window.to : ''}`;

/** Position of file offset `at` (an upper half inside the window) in the window's space. */
export const windowPos = (w: Window, at: number): number => ((at >> 16) - w.from) * HALF + (at & (HALF - 1));
/** File offset of window position `pos`. */
export const windowFile = (w: Window, pos: number): number => ((w.from + Math.floor(pos / HALF)) << 16) | HALF | (pos % HALF);
/** True when `at` lies in the window (an upper half of one of its banks). */
export const inWindow = (w: Window, at: number): boolean => (at & (BANK - 1)) >= HALF && (at >> 16) >= w.from && (at >> 16) < w.to;

/** The file spans `len` window bytes from file offset `at` cover: one, or one per upper half it runs into. */
export function windowPieces(w: Window, at: number, len: number): Span[] {
    const out: Span[] = [];
    for (let pos = windowPos(w, at), left = len; left > 0;) {
        const start = windowFile(w, pos), n = Math.min(left, HALF - (pos % HALF));
        out.push({ start, end: start + n });
        pos += n; left -= n;
    }
    return out;
}

/** The file spans an item occupies at `at` (its holes left out), each with the offset in the item it starts at. */
export function piecesOf(item: { bytes: Uint8Array; rule: Rule; holes?: Span[] }, at: number): (Span & { offset: number })[] {
    const runs: Span[] = [];
    let from = 0;
    for (const h of item.holes ?? []) { if (h.start > from) runs.push({ start: from, end: h.start }); from = Math.max(from, h.end); }
    if (from < item.bytes.length) runs.push({ start: from, end: item.bytes.length });
    const w = item.rule.window;
    return runs.flatMap(r => {
        if (!w) return [{ start: at + r.start, end: at + r.end, offset: r.start }];
        let offset = r.start;
        return windowPieces(w, windowFile(w, windowPos(w, at) + r.start), r.end - r.start).map(p => { const o = offset; offset += p.end - p.start; return { ...p, offset: o }; });
    });
}

export interface Layout {
    at: Map<string, number>;
    failed: Item[];
    /** Items not at their home. */
    moved: number;
}

/** mulberry32: small, seedable, good enough to shuffle. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle<T>(list: T[], next: () => number): T[] {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

/** Spans sorted, adjacent ones merged, then cut at bank boundaries. */
export function normalise(spans: Span[]): Span[] {
    const sorted = spans.filter(s => s.end > s.start).sort((a, b) => a.start - b.start);
    const merged: Span[] = [];
    for (const s of sorted) {
        const last = merged[merged.length - 1];
        if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
        else merged.push({ ...s });
    }
    return merged.flatMap(s => {
        const out: Span[] = [];
        for (let a = s.start; a < s.end; a = (a & ~(BANK - 1)) + BANK) out.push({ start: a, end: Math.min(s.end, (a & ~(BANK - 1)) + BANK) });
        return out;
    });
}

/** The first start at or after `from` inside `span` where `len` bytes obey `rule`; -1 if none. */
export function fitIn(span: Span, len: number, rule: Rule, from = span.start): number {
    if (rule.maxSize !== undefined && len > rule.maxSize) return -1;
    let s = Math.max(from, rule.above ?? 0);
    while (s + len <= span.end) {
        if (rule.below !== undefined && s + len > rule.below) return -1;
        if (rule.bankOffset !== undefined && (s & (BANK - 1)) !== rule.bankOffset) {
            const t = (s & ~(BANK - 1)) | rule.bankOffset;
            s = t >= s ? t : t + BANK; continue;
        }
        if (rule.upperHalf && (s & (BANK - 1)) < HALF) { s = (s & ~(BANK - 1)) + HALF; continue; }
        if (rule.lowerHalf && (s & (BANK - 1)) >= HALF) { s = (s & ~(BANK - 1)) + BANK; continue; }
        if ((rule.noCrossBank || rule.upperHalf) && (s >> 16) !== ((s + len - 1) >> 16)) { s = (s & ~(BANK - 1)) + BANK; continue; }
        return s;
    }
    return -1;
}

class Free {
    spans: Span[];
    constructor(spans: Span[]) { this.spans = normalise(spans); }
    /** Removes every piece if each lies inside one free span; else nothing. */
    take(pieces: Span[]): boolean {
        if (!pieces.every(p => this.spans.some(s => p.start >= s.start && p.end <= s.end))) return false;
        for (const p of pieces) {
            const i = this.spans.findIndex(s => p.start >= s.start && p.end <= s.end);
            const s = this.spans[i];
            this.spans.splice(i, 1, ...[{ start: s.start, end: p.start }, { start: p.end, end: s.end }].filter(x => x.end > x.start));
        }
        return true;
    }
    /** The free space as window positions: upper halves inside the window, joined across bank boundaries. */
    private windowSpans(w: Window): Span[] {
        const out: Span[] = [];
        for (const s of this.spans) {
            const start = Math.max(s.start, (s.start & ~(BANK - 1)) | HALF);
            if (start >= s.end || !inWindow(w, start)) continue;
            const a = windowPos(w, start), b = a + (s.end - start), last = out[out.length - 1];
            if (last && last.end === a) last.end = b; else out.push({ start: a, end: b });
        }
        return out;
    }
    /** File offsets where `len` bytes fit under `rule`: the first of each free span (window positions for a window). */
    private options(len: number, rule: Rule): number[] {
        if (!rule.window) return this.spans.map(s => fitIn(s, len, rule)).filter(at => at >= 0);
        if (rule.maxSize !== undefined && len > rule.maxSize) return [];
        const spans = this.windowSpans(rule.window);
        if (rule.bankOffset === undefined) return spans.filter(s => s.end - s.start >= len).map(s => windowFile(rule.window!, s.start));
        // A window item that must start at an offset in its bank (it crosses into the next bank at the same byte).
        const out: number[] = [];
        for (const s of spans) {
            let p = s.start - (s.start % HALF) + ((rule.bankOffset & (HALF - 1)));
            if (p < s.start) p += HALF;
            if (p + len <= s.end) out.push(windowFile(rule.window, p));
        }
        return out;
    }
    firstFit(len: number, rule: Rule): number { return this.options(len, rule)[0] ?? -1; }
    randomFit(len: number, rule: Rule, next: () => number): number {
        const options = this.options(len, rule);
        return options.length ? options[Math.floor(next() * options.length)] : -1;
    }
}

/**
 * `pool`: the bytes the items' kinds gave up (their homes lie in it). `extra`: other free space (manifest regions
 * with use "free"). `homes`: where each item was.
 */
export function allocate(items: Item[], pool: Span[], extra: Span[], homes: Map<string, Home>, seed?: number): Layout {
    const free = new Free([...pool, ...extra]);
    const at = new Map<string, number>();
    const failed: Item[] = [];
    const place = (item: Item, where: number) => { if (where >= 0 && free.take(piecesOf(item, where))) { at.set(item.key, where); return true; } return false; };
    const homed = items.filter(i => homes.has(i.key)).sort((a, b) => homes.get(a.key)!.at - homes.get(b.key)!.at);
    const rest: Item[] = items.filter(i => !homes.has(i.key));

    if (seed === undefined) {
        for (const item of homed) {
            const { at: home, length } = homes.get(item.key)!;
            const fits = item.rule.window ? inWindow(item.rule.window, home) : fitIn({ start: home, end: home + item.bytes.length }, item.bytes.length, item.rule) === home;
            const ok = item.bytes.length <= length && fits && place(item, home);
            if (!ok) rest.push(item);
        }
        for (const item of rest) if (!place(item, free.firstFit(item.bytes.length, item.rule))) failed.push(item);
    } else {
        const next = rng(seed);
        const spans = normalise(pool);
        const bySpan = new Map<Span, Item[]>();
        for (const item of homed) {
            const home = homes.get(item.key)!.at;
            const span = spans.find(s => home >= s.start && home < s.end);
            // A window item may run on into the next bank: it is placed among all the free window space instead.
            if (!span || item.rule.window || (extra.length && next() < 0.5)) { rest.push(item); continue; }
            if (!bySpan.has(span)) bySpan.set(span, []);
            bySpan.get(span)!.push(item);
        }
        // Cut each span where the rule changes: neighbours under one rule fill their run in any order, while a
        // run under a looser rule (a tile) shuffled into a tighter one's space (a room's upper half) would not.
        const groups: [Span, Item[]][] = [];
        for (const [span, members] of bySpan) {
            let run: Item[] = [], start = span.start;
            members.forEach((item, i) => {
                run.push(item);
                const nextItem = members[i + 1];
                if (nextItem && ruleKey(nextItem.rule) === ruleKey(item.rule)) return;
                const end = nextItem ? homes.get(nextItem.key)!.at : span.end;
                groups.push([{ start, end }, run]);
                run = []; start = end;
            });
        }
        for (const [span, members] of groups) {
            let cursor = span.start;
            for (const item of shuffle(members, next)) {
                const where = fitIn(span, item.bytes.length, item.rule, cursor);
                if (where >= 0 && place(item, where)) cursor = where + item.bytes.length;
                else rest.push(item);
            }
        }
        for (const item of shuffle(rest, next)) if (!place(item, free.randomFit(item.bytes.length, item.rule, next))) failed.push(item);
    }
    const moved = [...at].filter(([key, where]) => homes.get(key)?.at !== where).length;
    return { at, failed, moved };
}
