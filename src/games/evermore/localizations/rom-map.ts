// Ownership: Secret of Evermore ROM memory map and static lookup engine.
// Reads the canonical ROM catalog table (data/rom-map.md).
// Provides O(1) routine and address lookup for VFS (soe://rom/, soe://rom/code/).
// Pure: no emulator or VS Code dependency.

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';
import { hiromFileOffset } from '../../../platform/snes/hirom';

const HERE = sourceDir(__dirname);
const MAP_PATH = path.join(HERE, 'data', 'rom-map.md');

export interface RomEntry {
    addr: number;           // SNES bus address (e.g. 0x808020)
    fileOffset: number;     // ROM file offset (e.g. 0x008020)
    bank: number;           // Bank number (0x00..0xFF)
    name: string;           // Routine / symbol identifier
    type: string;           // code, table, script, data, sub
    size: number;           // Exact routine/table size in bytes
    end: number;            // Bus end address (addr + size - 1)
    tags: string[];         // tags
    summary: string;        // 1-2 sentence description
    category?: string;      // category
    confidence?: string;    // confirmed, likely, guess
}

export interface RomBankSummary {
    range: [string, string];
    name: string;
    routines: number;
    bytes: number;
    slack_bytes?: number;
}

export interface RomMapHeader {
    summary: {
        total_entries: number;
        total_documented_bytes: number;
        banks_covered: number;
        architecture: string;
    };
    banks: Record<string, RomBankSummary>;
}

let _initialized = false;
let _header: RomMapHeader | null = null;
let _entries: RomEntry[] = [];
const _byAddr = new Map<number, RomEntry>();
const _byOffset = new Map<number, RomEntry>();
const _byName = new Map<string, RomEntry>();
const _byBank = new Map<number, RomEntry[]>();
const _byKind = new Map<string, RomEntry[]>();
const _byTag = new Map<string, RomEntry[]>();

function ensureLoaded(): void {
    if (_initialized) return;
    _initialized = true;

    if (!fs.existsSync(MAP_PATH)) {
        console.error('ROM map file not found at:', MAP_PATH);
        return;
    }

    const mapText = fs.readFileSync(MAP_PATH, 'utf8');
    _entries = [];

    // Parse JSON front header
    const jsonMatch = mapText.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (jsonMatch) {
        try {
            _header = JSON.parse(jsonMatch[1]);
        } catch {}
    }

    for (const line of mapText.split('\n')) {
        if (!line.startsWith('|')) continue;
        const parts = line.split('|').map(s => s.trim().replace(/^`|`$/g, ''));
        if (parts.length < 7) continue;
        const addrMatch = parts[1].match(/^\$([0-9A-Fa-f]{2}):([0-9A-Fa-f]{4})$/);
        if (!addrMatch) continue;

        const bank = parseInt(addrMatch[1], 16);
        const off16 = parseInt(addrMatch[2], 16);
        const addr = (bank << 16) | off16;

        const nameMatch = parts[2].match(/\[`?([A-Za-z0-9_]+)`?\]/);
        const name = nameMatch ? nameMatch[1] : parts[2].replace(/[`*]/g, '').trim();

        const typeStr = parts[3];
        const sizeStr = parts[4];
        const sizeMatch = sizeStr.replace(/,/g, '').match(/^(\d+)/);
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 1;

        const tags = parts[5] ? parts[5].split(',').map(s => s.trim()).filter(Boolean) : [];
        const summary = parts[6];
        const fileOffset = hiromFileOffset(addr);
        const end = addr + size - 1;

        const entry: RomEntry = {
            addr,
            fileOffset,
            bank,
            name,
            type: typeStr,
            size,
            end,
            tags,
            summary,
        };

        _entries.push(entry);
        _byAddr.set(addr, entry);
        if (!_byOffset.has(fileOffset)) {
            _byOffset.set(fileOffset, entry);
        }
        if (!_byName.has(name)) {
            _byName.set(name, entry);
        }
        const bankList = _byBank.get(bank) || [];
        bankList.push(entry);
        _byBank.set(bank, bankList);

        const kindList = _byKind.get(typeStr) || [];
        kindList.push(entry);
        _byKind.set(typeStr, kindList);

        for (const tag of tags) {
            const tagList = _byTag.get(tag) || [];
            tagList.push(entry);
            _byTag.set(tag, tagList);
        }
    }
}

/** Get the ROM entry covering a 24-bit SNES bus address or file offset (exact start or inside routine range). */
export function getRomEntry(addr: number): RomEntry | null {
    ensureLoaded();
    const direct = _byAddr.get(addr);
    if (direct) return direct;

    const byOff = _byOffset.get(hiromFileOffset(addr));
    if (byOff) return byOff;

    if ((addr & 0x800000) === 0 && (addr & 0xFFFF) >= 0x8000) {
        const fast = _byAddr.get(addr | 0x800000);
        if (fast) return fast;
    }

    // Range lookup within bank
    const bank = (addr >> 16) & 0xFF;
    const inBank = _byBank.get(bank) || _byBank.get(bank | 0x80) || [];
    for (const e of inBank) {
        if (addr >= e.addr && addr <= e.end) {
            return e;
        }
    }

    return null;
}

/** Get the ROM entry by its unique routine/symbol name. */
export function getRomEntryByName(name: string): RomEntry | null {
    ensureLoaded();
    return _byName.get(name) || null;
}

/** Get all ROM entries sorted by address. */
export function getAllRomEntries(): RomEntry[] {
    ensureLoaded();
    return _entries;
}

/** Get all ROM entries in a specific bank ($00..$FF). */
export function getRomEntriesByBank(bank: number): RomEntry[] {
    ensureLoaded();
    return _byBank.get(bank) || [];
}

/** Get all ROM entries by kind ('code', 'table', 'blob', 'script'). */
export function getRomEntriesByKind(kind: string): RomEntry[] {
    ensureLoaded();
    return _byKind.get(kind) || [];
}

/** Get all ROM entries with a given tag (e.g. 'map', 'alchemy', 'combat', 'dialogue'). */
export function getRomEntriesByTag(tag: string): RomEntry[] {
    ensureLoaded();
    return _byTag.get(tag) || [];
}

/** Get master ROM map architecture metadata and per-bank summaries. */
export function getRomMapHeader(): RomMapHeader | null {
    ensureLoaded();
    return _header;
}

/** Get bank metadata summary for a given bank. */
export function getRomBankSummary(bank: number): RomBankSummary | null {
    ensureLoaded();
    if (!_header) return null;
    const hex = bank.toString(16).toUpperCase().padStart(2, '0');
    return _header.banks[hex] || null;
}

