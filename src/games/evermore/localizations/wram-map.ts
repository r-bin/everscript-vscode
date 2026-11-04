// Ownership: Bank $7E Working RAM (WRAM) memory map and static lookup engine.
// Reads the canonical zero-gap physical table (data/wram-map.md) and type definitions (data/types.json).
// Provides O(1) byte lookup for VFS (soe://ram/) and Memory Radar visualization.
// Pure: no emulator or VS Code dependency.

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';

const HERE = sourceDir(__dirname);
const MAP_PATH = path.join(HERE, 'data', 'wram-map.md');
const MAP_7F_PATH = path.join(HERE, 'data', 'wram-map-7f.md');
const TYPES_PATH = path.join(HERE, 'data', 'types.json');

export interface WramEntry {
    addr: number;
    busAddr: number;
    name: string;
    type: string;
    size: number;
    tags: string[];
    summary: string;
    lifecycle: string;
    inferredU16: boolean;
    scratchCandidate: boolean;
}

export interface WramField {
    offset: number;
    name: string;
    type: string;
}

export interface WramStruct {
    size: number;
    extends?: string;
    fields: WramField[];
}

export interface WramEnum {
    size?: number;
    values: Record<string, string>;
}

export interface WramTypes {
    typedefs: Record<string, { type: string; desc: string }>;
    enums: Record<string, WramEnum | Record<string, string>>;
    structs: Record<string, WramStruct>;
}

export interface WramMapEntry {
    name: string;
    nameParts: string[];
    type: string;
    notes: string;
    lifecycle: string;
    isWord: boolean;
    addrStart: number;
    addrEnd: number;
    tags?: string[];
}

interface AreaDef {
    range: [string, string];
    behavior: string;
}

interface HeaderJson {
    areas?: Record<string, AreaDef>;
    tag_tree?: Record<string, unknown>;
}

let _initialized = false;
let _entries: WramEntry[] = [];
let _types: WramTypes = { typedefs: {}, enums: {}, structs: {} };
const _lookupTable: (WramEntry | null)[] = new Array(0x20000).fill(null);
let _radarMapCache: Map<number, WramMapEntry> | null = null;
let _areas: { from: number; to: number; behavior: string }[] = [];

const toSize = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        return v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10);
    }
    return 1;
};

function resolveTypeSize(typeStr: string, types: WramTypes): number {
    if (!typeStr) return 1;
    const clean = typeStr.replace(/^`|`$/g, '').trim();
    const arrayMatch = clean.match(/^([A-Za-z0-9_]+)\[(\d+|0x[0-9a-fA-F]+)\]$/);
    if (arrayMatch) {
        const base = arrayMatch[1];
        const count = arrayMatch[2].startsWith('0x') ? parseInt(arrayMatch[2], 16) : parseInt(arrayMatch[2], 10);
        return resolveTypeSize(base, types) * count;
    }
    if (clean === 'u8' || clean === 'i8') return 1;
    if (clean === 'u16' || clean === 'i16') return 2;
    if (clean === 'u24' || clean === 'i24') return 3;
    if (clean === 'u32' || clean === 'i32') return 4;
    if (types.typedefs && types.typedefs[clean]) {
        return resolveTypeSize(types.typedefs[clean].type, types);
    }
    if (types.enums && types.enums[clean]) {
        const enumDef = types.enums[clean];
        if (typeof enumDef === 'object' && enumDef !== null && 'size' in enumDef) {
            return toSize(enumDef.size);
        }
        return 1;
    }
    if (types.structs && types.structs[clean]) {
        return toSize(types.structs[clean].size);
    }
    return 1;
}

function determineLifecycle(addr: number, tags: string[]): string {
    if (tags.includes('scratch_candidate')) return 'scratch';
    for (const a of _areas) {
        if (addr >= a.from && addr <= a.to) {
            if (a.behavior === 'scratch') return 'temp';
            if (a.behavior === 'sram') return 'sram';
            if (a.behavior === 'room') return 'temp';
            if (a.behavior === 'system') return 'system';
            return a.behavior;
        }
    }
    if (addr >= 0x2200 && addr <= 0x27FF) return 'session';
    if (addr >= 0x2834 && addr <= 0x28FF) return 'temp';
    return 'system';
}

function parseMapFile(filePath: string, defaultBank: number): void {
    if (!fs.existsSync(filePath)) {
        console.error('WRAM map file not found at:', filePath);
        return;
    }

    const mapText = fs.readFileSync(filePath, 'utf8');
    const baseOffset = defaultBank === 0x7F ? 0x10000 : 0x0000;

    // Parse areas header from JSON codeblock
    const jsonMatch = mapText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        try {
            const header: HeaderJson = JSON.parse(jsonMatch[1]);
            if (header.areas) {
                for (const def of Object.values(header.areas)) {
                    _areas.push({
                        from: baseOffset + parseInt(def.range[0], 16),
                        to: baseOffset + parseInt(def.range[1], 16),
                        behavior: def.behavior,
                    });
                }
            }
        } catch (err) {
            console.error(`Failed to parse header JSON in ${path.basename(filePath)}:`, err);
        }
    }

    const bankPrefix = `$${defaultBank.toString(16).toUpperCase()}:`;

    for (const line of mapText.split('\n')) {
        if (!line.startsWith('|')) continue;
        const parts = line.split('|').map(s => s.trim().replace(/^`|`$/g, ''));
        if (parts.length < 6 || !parts[1].startsWith(bankPrefix)) continue;

        const localAddr = parseInt(parts[1].slice(bankPrefix.length), 16);
        const addr = baseOffset + localAddr;
        const busAddr = (defaultBank << 16) | localAddr;
        const nameMatch = parts[2].match(/\[`?([A-Za-z0-9_]+)`?\]/);
        const name = nameMatch ? nameMatch[1] : parts[2].replace(/[`*]/g, '').trim();
        const typeStr = parts[3];
        const size = resolveTypeSize(typeStr, _types);
        const tags = parts[4] ? parts[4].split(',').map(s => s.trim()).filter(Boolean) : [];
        const summary = parts[5];
        const inferredU16 = tags.includes('inferred_u16') || summary.includes('[Inferred u16]');
        const scratchCandidate = tags.includes('scratch_candidate') || summary.includes('[Misplaced room scratch]');
        const lifecycle = determineLifecycle(addr, tags);

        const entry: WramEntry = {
            addr,
            busAddr,
            name,
            type: typeStr,
            size,
            tags,
            summary,
            lifecycle,
            inferredU16,
            scratchCandidate,
        };
        _entries.push(entry);

        for (let i = 0; i < size; i++) {
            const a = addr + i;
            if (a < 0x20000) {
                _lookupTable[a] = entry;
            }
        }
    }
}

function ensureLoaded(): void {
    if (_initialized) return;
    _initialized = true;

    try {
        if (fs.existsSync(TYPES_PATH)) {
            _types = JSON.parse(fs.readFileSync(TYPES_PATH, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load types.json:', err);
    }

    _areas = [];
    _entries = [];
    parseMapFile(MAP_PATH, 0x7E);
    parseMapFile(MAP_7F_PATH, 0x7F);
}

/** Get the entry covering this 16-bit WRAM address ($0000..$FFFF) or 17-bit offset ($00000..$1FFFF) or bus address ($7E0000..$7FFFFF). O(1) lookup. */
export function getWramEntry(addr: number): WramEntry | null {
    ensureLoaded();
    const off = addr >= 0x7E0000 ? addr - 0x7E0000 : addr;
    if (off < 0 || off >= 0x20000) return null;
    return _lookupTable[off] || null;
}

/** Get all contiguous WRAM entries. */
export function getAllWramEntries(): WramEntry[] {
    ensureLoaded();
    return _entries;
}

/** Get parsed WRAM types. */
export function getWramTypes(): WramTypes {
    ensureLoaded();
    return _types;
}

/** Resolve struct field or enum value for a specific byte offset. */
export function getWramFieldDetails(addr: number): {
    entry: WramEntry | null;
    structName?: string;
    fieldName?: string;
    fieldOffset?: number;
    fieldType?: string;
    enumName?: string;
    enumMembers?: Record<string, string>;
} {
    const entry = getWramEntry(addr);
    if (!entry) return { entry: null };

    const types = getWramTypes();
    const off = (addr >= 0x7E0000 ? addr - 0x7E0000 : addr) - entry.addr;

    // Check struct
    let structDef = types.structs?.[entry.type];
    if (!structDef) {
        const arrayMatch = entry.type.match(/^([A-Za-z0-9_]+)\[/);
        if (arrayMatch && types.structs?.[arrayMatch[1]]) {
            structDef = types.structs[arrayMatch[1]];
        }
    }

    if (structDef && structDef.fields) {
        // Handle array element offset
        const elemOffset = structDef.size > 0 ? off % structDef.size : off;
        const field = structDef.fields.slice().reverse().find(f => elemOffset >= f.offset);
        if (field) {
            return {
                entry,
                structName: entry.type,
                fieldName: field.name,
                fieldOffset: field.offset,
                fieldType: field.type,
            };
        }
    }

    // Check enum
    if (types.enums?.[entry.type]) {
        const rawEnum = types.enums[entry.type];
        const values: Record<string, string> =
            typeof rawEnum === 'object' && rawEnum !== null && 'values' in rawEnum
                ? (rawEnum.values as Record<string, string>)
                : (rawEnum as Record<string, string>);
        return {
            entry,
            enumName: entry.type,
            enumMembers: values,
        };
    }

    return { entry };
}

/** Get entries mapped for Memory Radar (MapEntry by addr). */
export function getWramMapEntries(): Map<number, WramMapEntry> {
    ensureLoaded();
    if (_radarMapCache) return _radarMapCache;

    const map = new Map<number, WramMapEntry>();
    for (const e of _entries) {
        const mapEntry: WramMapEntry = {
            name: e.name,
            nameParts: [e.name],
            type: e.type,
            notes: e.summary,
            lifecycle: e.lifecycle,
            isWord: e.size === 2,
            addrStart: e.addr,
            addrEnd: e.addr + e.size - 1,
            tags: e.tags,
        };
        for (let a = e.addr; a < e.addr + e.size && a < 0x20000; a++) {
            map.set(a, mapEntry);
        }
    }
    _radarMapCache = map;
    return _radarMapCache;
}
