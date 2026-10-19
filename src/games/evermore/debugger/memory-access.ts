/**
 * debugger/memory-access.ts
 *
 * WRAM by .evs names for the debugger: watch, debug console, hovers, inline
 * values, the Memory scope and VS Code's memory (hex) view. Pure: memory goes
 * through the bridge (read(address, length) / write(address, bytes)).
 *
 * Names come from the source map's symbols (the compiler's own enum entries
 * holding memory: MEMORY.X, FLAG.X, CUSTOM_MEMORY.X ...), with `lookupSymbol`
 * (the bundled language index) as a fallback for maps written before them.
 *
 * Location: { address (SNES bus), size (1 | 2), flag (bit mask) | undefined, type }
 */

import * as fs from 'fs';
import { constantNames, constantValue } from './value-types';
import type { Constants, MemorySymbol } from './value-types';
import { evaluateCondition } from './conditions';
import { hex as toHex } from '../../../platform';

/** Where a name or literal points: bus address, size, flag mask (a bit of the word) and the enum type that names its values. */
interface Location { address: number; size: number; flag?: number; type: string; enumType?: string }
/** `arg[n]` of the script slot instead of memory. */
interface ArgLocation { arg: number }
/** Reads and writes the emulator's memory. */
interface Bridge { read(address: number, length: number): Promise<Uint8Array | number[]>; write(address: number, bytes: number[]): Promise<unknown> }
/** The part of the source map this reads (debugger/source-map.ts). */
interface MapLike { symbols?: Map<string, MemorySymbol>; constants?: Constants; types?: Map<string, string> }
type LookupSymbol = ((name: string) => string | null | undefined) | null | undefined;
type Slot = { args: number[] } | null | undefined;

const WRAM = 0x7E0000;
const MAX_READ = 4096;
const NAME_PATTERN = /\b[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\b/g;
// <0x0ADA>, (Byte) <0x0ADA>, <0x28fa, 0x10>; not <BOY>[...] (entity-relative)
const MEMORY_PATTERN = /(?:\((?:Byte|Word)\)\s*)?<\s*0x[0-9a-fA-F]+\s*(?:,\s*(?:0x[0-9a-fA-F]+|\d+)\s*)?>/g;

const hex = (value: number, width: number): string => '0x' + toHex(value, width);

function typeOf(location: { flag?: number; size: number }): string {
    return location.flag !== undefined ? 'Flag' : location.size === 1 ? 'Byte' : 'Word';
}

function withType(location: { address: number; size: number; flag?: number }): Location {
    return Object.assign(location, { type: typeOf(location) });
}

/** Parse the .evs notation of a memory value: (Byte) <0x0ADA>, <0x289D>, <0x28fa, 0x10>. */
function parseMemoryText(text: unknown): Location | null {
    const m = String(text).trim().match(/^(?:\((Byte|Word)\)\s*)?<\s*(0x[0-9a-f]+)\s*(?:,\s*(0x[0-9a-f]+|\d+)\s*)?>$/i);
    if (!m) return null;
    const flag = m[3] !== undefined ? Number(m[3]) : undefined;
    const size = flag !== undefined ? 2 : m[1] && m[1].toLowerCase() === 'byte' ? 1 : 2;
    return withType({ address: WRAM + (parseInt(m[2], 16) & 0xFFFF), size, flag });
}

/**
 * An expression -> location, { arg: index } for arg[0x02], or null.
 * @param symbols     Map name -> { address, size, flag } (source map)
 * @param lookupSymbol (name) -> value text like "(Byte) <0x0ADA>", or null
 */
function parseLocation(expression: unknown, symbols?: Map<string, MemorySymbol> | null, lookupSymbol?: LookupSymbol): Location | ArgLocation | null {
    const text = String(expression || '').trim();
    let m = text.match(/^arg\[\s*(0x[0-9a-f]+|\d+)\s*\]$/i);
    if (m) return { arg: Number(m[1]) >> 1 };
    const literal = parseMemoryText(text);
    if (literal) return literal;
    m = text.match(/^(?:\$|0x)(7[EF][0-9a-f]{4})$/i) || text.match(/^\$([0-9a-f]{4})$/i);
    if (m) return withType({ address: m[1].length === 6 ? parseInt(m[1], 16) : WRAM + parseInt(m[1], 16), size: 2 });
    if (/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(text)) {
        const symbol = symbols && symbols.get(text);
        if (symbol) return withType({ address: WRAM + (symbol.address & 0xFFFF), size: symbol.size ?? 2, flag: symbol.flag ?? undefined });
        const value = lookupSymbol && lookupSymbol(text);
        if (value) return parseMemoryText(value);
    }
    return null;
}

/** The raw byte / word at a location. */
async function readNumber(location: Location, bridge: Bridge): Promise<number> {
    const bytes = await bridge.read(location.address, location.size);
    if (bytes.length < location.size) throw new Error('emulator memory not readable');
    return location.size === 1 ? bytes[0] : bytes[0] | (bytes[1] << 8);
}

/** Display text: flags as true / false, typed values by their enum names. */
function formatValue(location: Location, value: number, constants?: Constants): string {
    if (location.flag !== undefined) return ((value & location.flag) !== 0 ? 'true' : 'false') + '  (' + hex(value, 4) + ')';
    const text = hex(value, location.size * 2) + '  (' + value + ')';
    const names = location.enumType ? constantNames(constants || {}, location.enumType, value) : [];
    return names.length ? names.join(' | ') + '  ' + text : text;
}

/** Display text of a location's current value. */
async function readValue(location: Location, bridge: Bridge, constants?: Constants): Promise<string> {
    return formatValue(location, await readNumber(location, bridge), constants);
}

/** Number literal in .evs notation: 0x1F, 0d31, 31, true / false, or an ENUM.MEMBER constant. */
function parseValue(text: unknown, constants?: Constants): number {
    const t = String(text).trim();
    const constant = constants ? constantValue(constants, t) : undefined;
    if (constant !== undefined) return constant;
    if (/^(true|false)$/i.test(t)) return /^true$/i.test(t) ? 1 : 0;
    if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
    if (/^0d\d+$/i.test(t)) return parseInt(t.slice(2), 10);
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    throw new Error('Not a number: ' + text + ' (use 0x1F, 0d31, 31, true or false)');
}

/** Write a new value (a flag sets or clears its bit in the word). */
async function writeValue(location: Location, text: string, bridge: Bridge, constants?: Constants): Promise<string> {
    let value = parseValue(text, constants);
    if (location.flag !== undefined) {
        const [lo, hi] = await bridge.read(location.address, 2);
        const word = lo | (hi << 8);
        value = value ? word | location.flag : word & ~location.flag;
    }
    const bytes = location.size === 1 ? [value & 0xFF] : [value & 0xFF, (value >> 8) & 0xFF];
    await bridge.write(location.address, bytes);
    return readValue(location, bridge, constants);
}

/** DAP readMemory: bytes from a memoryReference (bus address) in chunks. */
async function readMemoryRequest(args: { memoryReference: string | number; offset?: number; count?: number }, bridge: Bridge) {
    const start = (Number(args.memoryReference) + (args.offset || 0)) >>> 0;
    const count = Math.max(0, Math.min(args.count || 0, 0x10000));
    const data: number[] = [];
    for (let at = 0; at < count; at += MAX_READ) {
        const chunk = await bridge.read(start + at, Math.min(MAX_READ, count - at));
        if (!chunk.length) break;
        data.push(...chunk);
    }
    return { address: hex(start, 6), data: Buffer.from(data).toString('base64'), unreadableBytes: count - data.length };
}

/** DAP writeMemory. */
async function writeMemoryRequest(args: { memoryReference: string | number; offset?: number; data?: string }, bridge: Bridge) {
    const start = (Number(args.memoryReference) + (args.offset || 0)) >>> 0;
    const bytes = [...Buffer.from(args.data || '', 'base64')];
    await bridge.write(start, bytes);
    return { bytesWritten: bytes.length };
}

/** Memory names and literals used in some .evs text, in order of appearance. */
function memoryNamesIn(text: unknown, symbols?: Map<string, MemorySymbol> | null, lookupSymbol?: LookupSymbol): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    for (const line of String(text).split('\n')) {
        const code = line.replace(/\/\/.*$/, '');
        for (const m of code.matchAll(NAME_PATTERN)) {
            if (seen.has(m[0]) || !parseLocation(m[0], symbols, lookupSymbol)) continue;
            seen.add(m[0]);
            found.push(m[0]);
        }
        for (const m of code.matchAll(MEMORY_PATTERN)) {
            const key = m[0].replace(/\s+/g, ' ');
            if (seen.has(key)) continue;
            seen.add(key);
            found.push(key);
        }
    }
    return found;
}

/** Text of file lines [start, end] (1-based), or '' when unreadable. */
function sourceLines(file: string, start: number, end: number): string {
    try {
        return fs.readFileSync(file, 'utf8').split('\n').slice(start - 1, end).join('\n');
    } catch (_) {
        return '';
    }
}

/** Memory lookups for one debug session (symbols change when the source map reloads). */
class MemoryInspector {
    /** @param getMap () -> SourceMap | null (symbols, constants, inferred types) */
    constructor(readonly bridge: Bridge, readonly getMap: () => MapLike | null | undefined, readonly lookupSymbol?: LookupSymbol) {}

    get constants(): Constants {
        const map = this.getMap();
        return (map && map.constants) || {};
    }

    locate(expression: unknown): Location | ArgLocation | null {
        const map = this.getMap();
        const location = parseLocation(expression, map && map.symbols, this.lookupSymbol);
        const enumType = location && map && map.types && map.types.get(String(expression).trim());
        if (enumType && location && 'type' in location && location.flag === undefined) {
            location.enumType = enumType;
            location.type += ': ' + enumType;
        }
        return location;
    }

    /** DAP value fields of a location: value, type, memory view, watch name. */
    async describe(expression: string, location: Location) {
        return {
            value: await readValue(location, this.bridge, this.constants),
            type: location.type,
            evaluateName: expression,
            memoryReference: hex(location.address, 6),
            variablesReference: 0,
        };
    }

    /** The Memory scope: every memory name used in lines [start, end] of file, with its value now. */
    async variables(file: string, start: number, end: number) {
        const variables: object[] = [];
        const map = this.getMap();
        for (const name of memoryNamesIn(sourceLines(file, start, end), map && map.symbols, this.lookupSymbol)) {
            const location = this.locate(name);
            if (location && !('arg' in location)) variables.push(Object.assign({ name }, await this.describe(name, location)));
        }
        return variables;
    }

    /** DAP evaluate (watch, console, hover). */
    async evaluate(expression: unknown, slot: Slot, context?: string) {
        const text = String(expression || '').trim();
        const location = this.locate(text);
        if (!location) {
            if (context === 'hover') throw new Error('not evaluable');
            throw new Error('Not memory. Supported: MEMORY.NAME (any enum entry holding memory), (Byte) <0x0ADA>, '
                + '<0x22EB>, <0x22EB, 0x01> (flag), $7E22EB, arg[0x02]');
        }
        if ('arg' in location) {
            const word = slot ? slot.args[location.arg] : undefined;
            if (word === undefined) throw new Error('no script slot');
            return { result: hex(word, 4) + '  (' + word + ')', type: 'Word', variablesReference: 0 };
        }
        const described = await this.describe(text, location);
        return { result: described.value, type: described.type, memoryReference: described.memoryReference, variablesReference: 0 };
    }

    /** setExpression / setVariable: write a value, answer with the new one. */
    async set(expression: unknown, value: string) {
        const location = this.locate(expression);
        if (!location || 'arg' in location) throw new Error('Only memory can be written');
        return { value: await writeValue(location, value, this.bridge, this.constants), type: location.type, variablesReference: 0 };
    }

    /** An if / while condition with the current memory: true, false, or undefined (unknowable). */
    evaluateCondition(text: string, slot: Slot) {
        return evaluateCondition(text, async (operand: string) => {
            const constant = constantValue(this.constants, operand);
            if (constant !== undefined) return constant;
            const location = this.locate(operand);
            if (!location) return undefined;
            if ('arg' in location) return slot ? slot.args[location.arg] : undefined;
            const value = await readNumber(location, this.bridge);
            return location.flag !== undefined ? ((value & location.flag) !== 0 ? 1 : 0) : value;
        });
    }
}

export type { Location, ArgLocation, Bridge };
export { MemoryInspector, NAME_PATTERN, MEMORY_PATTERN, parseLocation, readValue, writeValue, readMemoryRequest, writeMemoryRequest, memoryNamesIn, sourceLines, hex };
