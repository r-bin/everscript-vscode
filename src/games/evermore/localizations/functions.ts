// Ownership: ROM routines by bus address, as the rest of the plugin reads them. A view of the
// knowledge entries of kind `code` / `script` with a `category` (knowledge.ts); write new facts as
// entries (`game-knowledge` skill), never here.

import { entries } from './knowledge';
import { resolveLocalizedName } from './strings';
import type { NameOptions } from './strings';

/** { address, name, notes, category, stringIndex, id } per routine (name = the entry's title). */
const FUNCTIONS = entries('rom')
    .filter(e => (e.kind === 'code' || e.kind === 'script') && e.category)
    .map(e => ({
        address: e.addr, name: e.title, notes: e.purpose === e.title + '.' ? '' : e.purpose,
        category: e.category, stringIndex: null, id: e.name, confidence: e.confidence,
    }));

// Code runs from the $8x mirror; a lookup may come with the $Cx spelling or a file offset.
const FUNCTION_BY_OFFSET = new Map(FUNCTIONS.map(f => [f.address & 0x3FFFFF, f]));
const FUNCTION_BY_ADDRESS = new Map(FUNCTIONS.map(f => [f.address, f]));

function getFunction(address: unknown) {
    if (typeof address !== 'number') return null;
    return FUNCTION_BY_ADDRESS.get(address) || FUNCTION_BY_OFFSET.get(address & 0x3FFFFF) || null;
}

function getFunctionName(address: number, options: NameOptions = {}): string {
    const fn = getFunction(address);
    if (!fn) return `func_${address.toString(16).toUpperCase()}`;
    return resolveLocalizedName(fn, options.rom, 'name');
}

export { FUNCTIONS, FUNCTION_BY_ADDRESS, getFunction, getFunctionName };
