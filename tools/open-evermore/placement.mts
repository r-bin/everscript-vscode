// The manifest's placement (docs/open-evermore/manifest.md §1.4, mapping.md §3): per kind, settings that only narrow
// where its resources may go. The rule an item brings (its codec's, from the game mapping file) is what the engine
// allows; a setting outside it is `rule-loosened`, never applied. Game-neutral: SNES banks and halves only.
//
//   "placement": { "strings": { "banks": "$C0-$C3", "half": "lower" } }
//
//   banks   "$C0" or "$C0-$C3": the banks (HiROM $C0-$FF, or the same bank as $80-$BF) its resources must lie in
//   half    "upper" | "lower": the 32 KiB half of a bank
// Generated tables are not narrowed: they follow the code that reads them.
import type { Item, Rule } from './codec.mts';
import type { Findings } from './findings.mts';
import { FILE } from './manifest.mts';

export interface Setting { banks?: { from: number; to: number }; half?: 'upper' | 'lower' }

const FIELDS = new Set(['banks', 'half']);
const hex2 = (n: number) => '$' + n.toString(16).toUpperCase().padStart(2, '0');

/** The manifest's settings by kind; schema errors for an unknown kind, field or value. */
export function readPlacement(placement: unknown, kinds: string[], f: Findings): Map<string, Setting> {
    const out = new Map<string, Setting>();
    if (placement === undefined) return out;
    if (typeof placement !== 'object' || placement === null || Array.isArray(placement)) { f.error('schema', FILE, '/placement', 'an object: kind → { banks, half }'); return out; }
    for (const [kind, v] of Object.entries(placement as Record<string, unknown>)) {
        const at = `/placement/${kind}`;
        if (!kinds.includes(kind)) { f.error('schema', FILE, at, `no kind "${kind}" (${kinds.join(', ')})`); continue; }
        if (typeof v !== 'object' || v === null) { f.error('schema', FILE, at, '{ "banks": "$C0-$C3", "half": "lower" }'); continue; }
        const s: Setting = {}, o = v as Record<string, unknown>;
        for (const k of Object.keys(o)) if (!FIELDS.has(k)) f.error('schema', FILE, `${at}/${k}`, `"${k}": the manifest narrows only banks and half`);
        if (o.banks !== undefined) {
            const m = typeof o.banks === 'string' ? /^\$([0-9A-Fa-f]{2})(?:-\$([0-9A-Fa-f]{2}))?$/.exec(o.banks) : null;
            const from = m ? parseInt(m[1], 16) : -1, to = m ? parseInt(m[2] ?? m[1], 16) : -1;
            if (!m || from < 0x80 || to < from || (from < 0xC0) !== (to < 0xC0)) f.error('schema', FILE, `${at}/banks`, '"$C0" or "$C0-$C3" (banks $80-$FF)');
            else s.banks = { from: from & 0x3F, to: (to & 0x3F) + 1 };
        }
        if (o.half !== undefined) {
            if (o.half !== 'upper' && o.half !== 'lower') f.error('schema', FILE, `${at}/half`, '"upper" or "lower"');
            else s.half = o.half;
        }
        out.set(kind, s);
    }
    return out;
}

/** `rule` narrowed by `s`, or why it cannot be (the setting asks for space the engine does not allow). */
export function narrow(rule: Rule, s: Setting): Rule | string {
    const r: Rule = { ...rule };
    if (s.half) {
        const upper = !!(r.upperHalf || r.window) || (r.bankOffset !== undefined && r.bankOffset >= 0x8000);
        const lower = !!r.lowerHalf || (r.bankOffset !== undefined && r.bankOffset < 0x8000);
        if (s.half === 'lower' && upper) return 'it must lie in an upper half';
        if (s.half === 'upper' && lower) return 'it must lie in a lower half';
        if (s.half === 'upper') r.upperHalf = true; else r.lowerHalf = true;
    }
    if (s.banks) {
        if (r.window) {
            const from = Math.max(r.window.from, s.banks.from), to = Math.min(r.window.to, s.banks.to);
            if (from >= to) return `its window is banks ${hex2(r.window.from | 0x80)}-${hex2((r.window.to - 1) | 0x80)}`;
            r.window = { from, to };
        } else {
            const above = Math.max(r.above ?? 0, s.banks.from << 16), below = Math.min(r.below ?? Infinity, s.banks.to << 16);
            if (above >= below) return r.above !== undefined || r.below !== undefined
                ? `it must lie in ${hex2(((r.above ?? 0) >> 16) | 0xC0)}:${((r.above ?? 0) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}–${r.below === undefined ? 'the end' : hex2(((r.below - 1) >> 16) | 0xC0) + ':' + ((r.below - 1) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
                : 'no space is left';
            r.above = above;
            if (below !== Infinity) r.below = below;
        }
    }
    return r;
}

/** Narrows the rules of `kind`'s items in place; one `rule-loosened` per setting that does not fit, with how many it hit. */
export function applyPlacement(kind: string, items: Item[], settings: Map<string, Setting>, f: Findings): void {
    const s = settings.get(kind);
    if (!s) return;
    let first: { item: Item; why: string } | undefined, count = 0;
    for (const item of items) {
        if (item.generated) continue;
        const r = narrow(item.rule, s);
        if (typeof r === 'string') { first ??= { item, why: r }; count++; }
        else item.rule = r;
    }
    if (first) f.error('rule-loosened', FILE, `/placement/${kind}`, `${first.item.key}${count > 1 ? ` and ${count - 1} more` : ''}: ${first.why} (the game mapping file's rule for ${kind}); the manifest only narrows it`);
}
