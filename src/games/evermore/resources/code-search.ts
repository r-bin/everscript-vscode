// Ownership: what `soe://rom/code/index.md?…` filters by, and what `todo.md` lists: the search over
// routines (name, knowledge text, C, the WRAM they touch, what they call) and the open decompilation
// work per routine. Pure over a catalog (code-catalog.ts).

import { entries } from '../localizations/knowledge';
import type { KnowledgeEntry } from '../localizations/knowledge';
import { analyse } from './code-catalog';
import type { Catalog, CodeFunction } from './code-catalog';
import { magicNumbers } from './code-c-index';

/** Open work on a routine, by kind (the `status=` filter values). */
const TODO_KINDS: Record<string, string> = {
    'no-c': 'no reconstructed C',
    magic: 'raw numbers in the C that want a name',
    'unnamed-calls': 'calls routines that have no entry',
    'generic-name': 'placeholder name',
    'no-purpose': 'no plain-language purpose',
    guess: 'confidence `guess`',
    legacy: 'how it was learned was never recorded',
    uncommented: 'no asm comments',
    missing: 'not found in this ROM',
};
const GENERIC = /^(unknown|func|sub|fn|routine|code|loc)_|_[0-9a-f]{6}$|^[a-z_]{40,}$/i;
const MAGIC_MIN = 3;

interface Todo { kind: string; detail: string }

/** The open work on `fn` (empty: nothing known to be missing). */
function todos(cat: Catalog, fn: CodeFunction): Todo[] {
    const out: Todo[] = [], e = fn.entry, a = analyse(cat, fn);
    if (fn.at.how === 'missing') out.push({ kind: 'missing', detail: 'no match for its US bytes' });
    if (!fn.c) out.push({ kind: 'no-c', detail: 'write it in reconstructed-c/' });
    const magic = fn.c ? magicNumbers(fn.c) : [];
    if (magic.length >= MAGIC_MIN) out.push({ kind: 'magic', detail: magic.slice(0, 6).join(', ') + (magic.length > 6 ? ', …' : '') });
    const unnamed = a ? a.calls.filter(t => !cat.byAddr.has(t) && !cat.byAddr.has(t ^ 0x400000)) : [];
    if (unnamed.length) out.push({ kind: 'unnamed-calls', detail: unnamed.slice(0, 4).map(hex6).join(', ') + (unnamed.length > 4 ? ', …' : '') });
    if (GENERIC.test(e.name || '')) out.push({ kind: 'generic-name', detail: e.name || '(none)' });
    if (!e.purpose || e.purpose === e.title + '.' || e.purpose.length < 25) out.push({ kind: 'no-purpose', detail: 'first paragraph of the entry' });
    if (!e.confidence || e.confidence === 'guess') out.push({ kind: 'guess', detail: e.confidence || 'no confidence' });
    if (e.evidence.some(x => x.startsWith('legacy:'))) out.push({ kind: 'legacy', detail: 'add real evidence' });
    if (a && a.commented === 0) out.push({ kind: 'uncommented', detail: `${a.lines.length} lines` });
    return out;
}

const hex6 = (v: number): string => '$' + (v >>> 0).toString(16).toUpperCase().padStart(6, '0');

/** The RAM entry covering `addr`, if any. */
function ramEntry(addr: number): KnowledgeEntry | null {
    return entries('ram').find(r => addr >= r.addr && addr <= r.end) || null;
}

/** A hex query as an address: 4 digits are low WRAM ($7E), 6 digits a bus address. */
function queryAddress(q: string): number | null {
    const s = q.replace(/^(\$|0x)/i, '').replace(':', '');
    if (!/^[0-9a-f]{4}$|^[0-9a-f]{6}$/i.test(s)) return null;
    const v = parseInt(s, 16);
    return s.length === 4 ? 0x7E0000 | v : v;
}

/** Why `fn` matches query `q` (empty: it does not). WRAM matches cover the whole RAM entry the address is in. */
function whyMatches(cat: Catalog, fn: CodeFunction, q: string): string[] {
    const why: string[] = [], e = fn.entry, lower = q.toLowerCase(), a = analyse(cat, fn);
    const addr = queryAddress(q);
    if (addr !== null && addr >= 0x7E0000 && addr <= 0x7FFFFF) {
        const r = ramEntry(addr), lo = r ? r.addr : addr, hi = r ? r.end : addr;
        for (const u of a ? a.wram : []) {
            if (u.addr >= lo && u.addr <= hi) why.push(`${[...u.access].join('/')} ${hex6(u.addr)}${r ? ' ' + r.name : ''}${u.viaDb ? ' (DB $7E)' : ''}`);
        }
    } else if (addr !== null) {
        const last = a && a.lines.length ? a.lines[a.lines.length - 1].addr : fn.at.addr;
        const inside = (x: number | null) => x !== null && last !== null && addr >= x && addr <= last;
        if (inside(fn.at.addr) || (fn.at.addr !== fn.vanilla && inside(fn.vanilla))) why.push(`contains ${hex6(addr)}`);
        if (a && a.calls.some(t => t === addr || t === (addr ^ 0x400000))) why.push(`calls ${hex6(addr)}`);
    }
    if ((e.name || '').toLowerCase().includes(lower) || e.title.toLowerCase().includes(lower)) why.push('name');
    if (e.tags.some(t => t.toLowerCase().includes(lower)) || (e.category || '') === q) why.push('tag');
    if (!why.length && e.body.toLowerCase().includes(lower)) why.push('knowledge text');
    if (fn.c && fn.c.text.toLowerCase().includes(lower)) why.push('C');
    if (addr === null && a) {
        const named = ramMatching(lower);
        const hits = a.wram.filter(u => named.some(r => u.addr >= r.addr && u.addr <= r.end));
        for (const u of hits.slice(0, 3)) why.push(`${[...u.access].join('/')} ${ramEntry(u.addr)?.name || hex6(u.addr)}`);
    }
    return why;
}

const ramCache = new Map<string, KnowledgeEntry[]>();
/** RAM entries whose name, title or tags contain `lower`. */
function ramMatching(lower: string): KnowledgeEntry[] {
    if (!ramCache.has(lower)) {
        ramCache.set(lower, lower.length < 3 ? [] : entries('ram').filter(r =>
            (r.name || '').toLowerCase().includes(lower) || r.title.toLowerCase().includes(lower) || r.tags.some(t => t.toLowerCase().includes(lower))));
    }
    return ramCache.get(lower) as KnowledgeEntry[];
}

/** The routines `params` selects (q, status, bank, category, confidence), each with why it matched. */
function select(cat: Catalog, params: URLSearchParams): { fn: CodeFunction; why: string[] }[] {
    const q = (params.get('q') || params.get('query') || '').trim();
    const status = params.get('status'), bank = params.get('bank'), category = params.get('category'), confidence = params.get('confidence');
    const out: { fn: CodeFunction; why: string[] }[] = [];
    for (const fn of cat.list) {
        if (bank && ((fn.vanilla >> 16) & 0xFF).toString(16) !== bank.toLowerCase().replace('$', '')) continue;
        if (category && fn.entry.category !== category) continue;
        if (confidence && fn.entry.confidence !== confidence) continue;
        if (status === 'c' && !fn.c) continue;
        if (status === 'todo' && !todos(cat, fn).length) continue;
        if (status && status in TODO_KINDS && !todos(cat, fn).some(t => t.kind === status)) continue;
        if (status === 'moved' && fn.at.how !== 'moved') continue;
        const why = q ? whyMatches(cat, fn, q) : [];
        if (q && !why.length) continue;
        out.push({ fn, why });
    }
    return out;
}

export type { Todo };
export { TODO_KINDS, todos, select, ramEntry, hex6 };
