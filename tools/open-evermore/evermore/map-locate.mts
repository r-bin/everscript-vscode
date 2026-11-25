// Drafts the mapping file of another release (docs/open-evermore/mapping.md §5): the language builds hold the same
// content compiled to other banks, so most of what an address of map/us.json holds can be found again in their ROM.
// For each address: the bytes at it in the US ROM, found once in the other ROM (a table, a record, code that did not
// change); else the bytes around it with the address's own 3 bytes left out (an operand that points elsewhere now).
// A hit counts only when it is the one place those bytes occur. Banks and placement are not located: a person reads them.
// The draft is a proposal: every entry is to be checked against the release's code before it is used.
import type { GameMap } from './map.mts';

const ADDRESS = /^\$([0-9A-F]{2}):([0-9A-F]{4})([+-]\d+)?$/;
const fileOf = (bus: number) => bus & 0x3FFFFF;
/** File offset `at` written in the form `like` uses ($8x or $Cx bank), with its add. */
const formed = (like: string, at: number, add: string | undefined) => {
    const bank = (at >> 16) | (parseInt(like.slice(1, 3), 16) & 0xC0);
    return `$${bank.toString(16).toUpperCase().padStart(2, '0')}:${(at & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}${add ?? ''}`;
};

export type How = 'same' | 'bytes' | 'around';
export interface Located { key: string; list: boolean; from: string; to: string | null; how: How | 'not-found' | 'bank' }

/** Every place `needle` occurs in `hay`, at most `max`. */
function occurrences(hay: Buffer, needle: Buffer, max = 2): number[] {
    const out: number[] = [];
    for (let i = hay.indexOf(needle); i >= 0 && out.length < max; i = hay.indexOf(needle, i + 1)) out.push(i);
    return out;
}

/** Where file offset `at` of `us` is in `rom`, and how it was found; null when nowhere for sure. */
export function locateOne(us: Buffer, rom: Buffer, at: number): { at: number; how: How } | null {
    for (const n of [16, 32, 64]) {
        if (at + n > us.length) break;
        const hits = occurrences(rom, us.subarray(at, at + n));
        if (hits.length === 1) return { at: hits[0], how: hits[0] === at ? 'same' : 'bytes' };
        if (hits.length === 0) break;
    }
    // The bytes before and after, the address's own 3 left out: the part before found, the part after where it must be.
    for (const n of [8, 12, 24, 48]) {
        if (at < n || at + 3 + n > us.length) break;
        const before = us.subarray(at - n, at), after = us.subarray(at + 3, at + 3 + n);
        const hits = occurrences(rom, before, 64).filter(h => rom.subarray(h + n + 3, h + n + 3 + n).equals(after));
        if (hits.length === 1) return { at: hits[0] + n, how: hits[0] + n === at ? 'same' : 'around' };
        if (hits.length === 0) break;
    }
    return null;
}

/** Every address of `map` (the US map), located in `rom`. */
export function locateAll(map: GameMap, us: Buffer, rom: Buffer): Located[] {
    const out: Located[] = [];
    for (const [key, value] of map.addresses) {
        const list = Array.isArray(value);
        for (const v of list ? value : [value]) {
            const m = ADDRESS.exec(v);
            // A bank, or the base of one: nothing to search for.
            if (!m || m[2] === '0000') { out.push({ key, list, from: v, to: null, how: 'bank' }); continue; }
            const hit = locateOne(us, rom, fileOf(parseInt(m[1] + m[2], 16)));
            out.push({ key, list, from: v, to: hit ? formed(v, hit.at, m[3]) : null, how: hit?.how ?? 'not-found' });
        }
    }
    return out;
}

/** The draft file: what moved, as `extends: "us"` reads it, and what a person still has to find (`open`). */
export function draft(release: string, name: string, located: Located[]): unknown {
    const addresses: Record<string, Record<string, string | string[]>> = {};
    const open: Record<string, string> = {};
    const byKey = new Map<string, Located[]>();
    for (const l of located) byKey.set(l.key, [...(byKey.get(l.key) ?? []), l]);
    for (const [key, ls] of byKey) {
        const kind = key.slice(0, key.indexOf('.')), entry = key.slice(key.indexOf('.') + 1);
        if (ls.some(l => l.to === null)) { open[key] = ls.map(l => `${l.from}: ${l.to ?? l.how}`).join(', '); continue; }
        if (ls.every(l => l.to === l.from)) continue;
        (addresses[kind] ??= {})[entry] = ls[0].list ? ls.map(l => l.to!) : ls[0].to!;
    }
    return {
        release, name, extends: 'us',
        what: 'DRAFT by open-evermore locate: every address below was found by its US bytes and must be checked against this release\'s code; "open" lists what was not found (banks are never searched) and still reads as the US value. Placement is us.json\'s, unchecked.',
        addresses, open, placement: {},
    };
}
