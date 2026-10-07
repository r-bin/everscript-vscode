'use strict';

/**
 * debugger/memory-access.js
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

const fs = require('fs');

const WRAM = 0x7E0000;
const MAX_READ = 4096;
const NAME_PATTERN = /\b[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\b/g;
// <0x0ADA>, (Byte) <0x0ADA>, <0x28fa, 0x10>; not <BOY>[...] (entity-relative)
const MEMORY_PATTERN = /(?:\((?:Byte|Word)\)\s*)?<\s*0x[0-9a-fA-F]+\s*(?:,\s*(?:0x[0-9a-fA-F]+|\d+)\s*)?>/g;

function hex(value, width) {
    return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function typeOf(location) {
    return location.flag !== undefined ? 'Flag' : location.size === 1 ? 'Byte' : 'Word';
}

function withType(location) {
    return Object.assign(location, { type: typeOf(location) });
}

/** Parse the .evs notation of a memory value: (Byte) <0x0ADA>, <0x289D>, <0x28fa, 0x10>. */
function parseMemoryText(text) {
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
function parseLocation(expression, symbols, lookupSymbol) {
    const text = String(expression || '').trim();
    let m = text.match(/^arg\[\s*(0x[0-9a-f]+|\d+)\s*\]$/i);
    if (m) return { arg: Number(m[1]) >> 1 };
    const literal = parseMemoryText(text);
    if (literal) return literal;
    m = text.match(/^(?:\$|0x)(7[EF][0-9a-f]{4})$/i) || text.match(/^\$([0-9a-f]{4})$/i);
    if (m) return withType({ address: m[1].length === 6 ? parseInt(m[1], 16) : WRAM + parseInt(m[1], 16), size: 2 });
    if (/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(text)) {
        const symbol = symbols && symbols.get(text);
        if (symbol) return withType({ address: WRAM + (symbol.address & 0xFFFF), size: symbol.size, flag: symbol.flag });
        const value = lookupSymbol && lookupSymbol(text);
        if (value) return parseMemoryText(value);
    }
    return null;
}

/** Display text of a location's current value. */
async function readValue(location, bridge) {
    const bytes = await bridge.read(location.address, location.size);
    if (bytes.length < location.size) throw new Error('emulator memory not readable');
    const value = location.size === 1 ? bytes[0] : bytes[0] | (bytes[1] << 8);
    if (location.flag !== undefined) return ((value & location.flag) !== 0 ? 'true' : 'false') + '  (' + hex(value, 4) + ')';
    return hex(value, location.size * 2) + '  (' + value + ')';
}

/** Number literal in .evs notation: 0x1F, 0d31, 31, true / false. */
function parseValue(text) {
    const t = String(text).trim();
    if (/^(true|false)$/i.test(t)) return /^true$/i.test(t) ? 1 : 0;
    if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
    if (/^0d\d+$/i.test(t)) return parseInt(t.slice(2), 10);
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    throw new Error('Not a number: ' + text + ' (use 0x1F, 0d31, 31, true or false)');
}

/** Write a new value (a flag sets or clears its bit in the word). */
async function writeValue(location, text, bridge) {
    let value = parseValue(text);
    if (location.flag !== undefined) {
        const [lo, hi] = await bridge.read(location.address, 2);
        const word = lo | (hi << 8);
        value = value ? word | location.flag : word & ~location.flag;
    }
    const bytes = location.size === 1 ? [value & 0xFF] : [value & 0xFF, (value >> 8) & 0xFF];
    await bridge.write(location.address, bytes);
    return readValue(location, bridge);
}

/** DAP readMemory: bytes from a memoryReference (bus address) in chunks. */
async function readMemoryRequest(args, bridge) {
    const start = (Number(args.memoryReference) + (args.offset || 0)) >>> 0;
    const count = Math.max(0, Math.min(args.count || 0, 0x10000));
    const data = [];
    for (let at = 0; at < count; at += MAX_READ) {
        const chunk = await bridge.read(start + at, Math.min(MAX_READ, count - at));
        if (!chunk.length) break;
        data.push(...chunk);
    }
    return { address: hex(start, 6), data: Buffer.from(data).toString('base64'), unreadableBytes: count - data.length };
}

/** DAP writeMemory. */
async function writeMemoryRequest(args, bridge) {
    const start = (Number(args.memoryReference) + (args.offset || 0)) >>> 0;
    const bytes = [...Buffer.from(args.data || '', 'base64')];
    await bridge.write(start, bytes);
    return { bytesWritten: bytes.length };
}

/** Memory names and literals used in some .evs text, in order of appearance. */
function memoryNamesIn(text, symbols, lookupSymbol) {
    const found = [];
    const seen = new Set();
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
function sourceLines(file, start, end) {
    try {
        return fs.readFileSync(file, 'utf8').split('\n').slice(start - 1, end).join('\n');
    } catch (_) {
        return '';
    }
}

/** Memory lookups for one debug session (symbols change when the source map reloads). */
class MemoryInspector {
    constructor(bridge, getSymbols, lookupSymbol) {
        this.bridge = bridge;
        this.getSymbols = getSymbols;
        this.lookupSymbol = lookupSymbol;
    }

    locate(expression) {
        return parseLocation(expression, this.getSymbols(), this.lookupSymbol);
    }

    /** DAP value fields of a location: value, type, memory view, watch name. */
    async describe(expression, location) {
        return {
            value: await readValue(location, this.bridge),
            type: location.type,
            evaluateName: expression,
            memoryReference: hex(location.address, 6),
            variablesReference: 0,
        };
    }

    /** The Memory scope: every memory name used in lines [start, end] of file, with its value now. */
    async variables(file, start, end) {
        const variables = [];
        for (const name of memoryNamesIn(sourceLines(file, start, end), this.getSymbols(), this.lookupSymbol)) {
            const location = this.locate(name);
            if (location && location.arg === undefined) variables.push(Object.assign({ name }, await this.describe(name, location)));
        }
        return variables;
    }

    /** DAP evaluate (watch, console, hover). */
    async evaluate(expression, slot, context) {
        const text = String(expression || '').trim();
        const location = this.locate(text);
        if (!location) {
            if (context === 'hover') throw new Error('not evaluable');
            throw new Error('Not memory. Supported: MEMORY.NAME (any enum entry holding memory), (Byte) <0x0ADA>, '
                + '<0x22EB>, <0x22EB, 0x01> (flag), $7E22EB, arg[0x02]');
        }
        if (location.arg !== undefined) {
            const word = slot ? slot.args[location.arg] : undefined;
            if (word === undefined) throw new Error('no script slot');
            return { result: hex(word, 4) + '  (' + word + ')', type: 'Word', variablesReference: 0 };
        }
        const described = await this.describe(text, location);
        return { result: described.value, type: described.type, memoryReference: described.memoryReference, variablesReference: 0 };
    }

    /** setExpression / setVariable: write a value, answer with the new one. */
    async set(expression, value) {
        const location = this.locate(expression);
        if (!location || location.arg !== undefined) throw new Error('Only memory can be written');
        return { value: await writeValue(location, value, this.bridge), type: location.type, variablesReference: 0 };
    }
}

module.exports = {
    MemoryInspector,
    NAME_PATTERN,
    MEMORY_PATTERN,
    parseLocation,
    readValue,
    writeValue,
    readMemoryRequest,
    writeMemoryRequest,
    memoryNamesIn,
    sourceLines,
    hex,
};
