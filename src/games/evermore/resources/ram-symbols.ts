// Ownership: every WRAM address the plugin knows, in one list — the contiguous
// zero-gap table (data/wram-map.md, data/types.json), the named addresses of
// src/games/evermore/script-model/names.json, the WRAM links of `soe://tags/`, and the
// flag bytes (one entry per byte, bits named). Pure: no emulator.
//
//   ramSymbols(): { addr, size, type, name, tags, values?, bits?, summary? }
//   ramBlocks():  { addr, size, tags } — records longer than 4 bytes (entity, stats block)

import NAMES from '../script-model/names.json';
import { tagModel } from './tag-model';
import { getAllWramEntries, getWramEntry } from '../localizations/wram-map';

/** One known WRAM address. */
interface RamSymbol {
    addr: number;
    size: number | null;
    type: string | null;
    name: string | null;
    tags: string[];
    values?: unknown;
    bits?: Record<number, string>;
    summary?: string;
}
interface RamBlock { addr: number; size: number; tags: string[] }
const NAMES_RAM = NAMES.ram as Record<string, string>;
const NAMES_VALUES = NAMES.ramValues as unknown as Record<string, unknown>;
const NAMES_FLAGS = NAMES.flags as Record<string, string>;

const TYPE: Record<number, string> = { 1: 'byte', 2: 'word', 3: 'long', 4: 'dword' };
const WRAM = 0x7E0000;

/** names.json labels end in their own address: `PRIZE ($2391)` → `PRIZE`. */
const label = (s: unknown): string => String(s).replace(/\s*\(\$[0-9a-f]+\)\s*$/i, '');

/** `soe://ram/4eb3.json` → { addr, len }; `0a49[4].bin` → len 4; flag bits and other authorities → null. */
function ramTarget(uri: string): { addr: number; len: number | null } | null {
    const m = /^soe:\/\/ram\/([0-9a-f]{1,6})(?:\[([0-9a-f]{1,5})\])?\.(json|bin)$/i.exec(uri);
    if (!m) return null;
    const addr = parseInt(m[1], 16);
    return { addr: addr >= WRAM ? addr - WRAM : addr, len: m[2] ? parseInt(m[2], 16) : null };
}

let _cache: RamSymbol[] | null = null, _blocks: RamBlock[] | null = null;

/** Every known WRAM address, sorted; flag bytes included. */
function ramSymbols(): RamSymbol[] {
    if (_cache) return _cache;
    const byAddr = new Map<number, RamSymbol>();
    const entry = (addr: number): RamSymbol => {
        if (!byAddr.has(addr)) byAddr.set(addr, { addr, size: null, type: null, name: null, tags: [] });
        return byAddr.get(addr)!;
    };

    // 1. Load from the canonical contiguous zero-gap WRAM map table
    const tableEntries = getAllWramEntries();
    const blocks = new Map<string, RamBlock>();

    for (const t of tableEntries) {
        const e = entry(t.addr);
        e.name = t.name;
        e.type = t.type;
        e.size = t.size;
        e.summary = t.summary;
        for (const tag of t.tags) {
            if (!e.tags.includes(tag)) e.tags.push(tag);
        }
        if (t.size > 4) {
            const key = `${t.addr}:${t.size}`;
            if (!blocks.has(key)) blocks.set(key, { addr: t.addr, size: t.size, tags: [...t.tags] });
        }
    }

    // 2. Overlay values from names.json
    for (const [a, name] of Object.entries(NAMES_RAM)) {
        const num = Number(a);
        const e = entry(num);
        if (!e.name) e.name = label(name);
        if (NAMES_VALUES[a]) e.values = NAMES_VALUES[a];
    }

    // 3. Flag bits
    for (const [k, name] of Object.entries(NAMES_FLAGS)) {
        const [a, bit] = k.split(':').map(Number);
        const e = entry(a);
        e.type = 'flags';
        e.size = 1;
        (e.bits = e.bits || {})[bit] = name;
    }

    // 4. Tag model links
    const model = tagModel();
    for (const t of model.tags.values()) {
        for (const l of t.links) {
            const r = ramTarget(l.uri);
            if (!r) continue;
            if (r.len !== null && r.len > 4) {
                const key = `${r.addr}:${r.len}`;
                if (!blocks.has(key)) blocks.set(key, { addr: r.addr, size: r.len, tags: [] });
                if (!blocks.get(key)!.tags.includes(t.id)) blocks.get(key)!.tags.push(t.id);
                continue;
            }
            const e = entry(r.addr);
            if (!e.tags.includes(t.id)) e.tags.push(t.id);
            if (e.type === 'flags') continue;
            const size = (r.len ?? t.size ?? null) as number | null;
            if (size && !e.size) e.size = size;
            if (!e.name) e.name = model.title(t.id) || t.id;
        }
    }

    for (const e of byAddr.values()) {
        if (!e.size) e.size = 2;
        if (!e.type) e.type = TYPE[e.size] || 'byte';
    }

    _cache = [...byAddr.values()].sort((x, y) => x.addr - y.addr);
    _blocks = [...blocks.values()].sort((x, y) => x.addr - y.addr);
    return _cache;
}

/** Records longer than 4 bytes that tags link as `<addr>[<len>].bin`. */
function ramBlocks(): RamBlock[] {
    ramSymbols();
    return _blocks!;
}

/** The known entry at a WRAM offset, or null (fast lookup via wram-map). */
function ramSymbol(addr: number): RamSymbol | null {
    const list = ramSymbols();
    const exact = list.find(e => e.addr === addr);
    if (exact) return exact;

    // Check if covered by a contiguous table entry
    const entry = getWramEntry(addr);
    if (!entry) return null;
    return list.find(e => e.addr === entry.addr) || null;
}

export type { RamSymbol, RamBlock };
export { ramSymbols, ramSymbol, ramBlocks };
