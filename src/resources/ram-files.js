'use strict';
// Ownership: `soe://ram/` — the running emulator's 128 KB WRAM as files.
// Values come from `readMemory(busAddr, len)`, which extension.js wires to the
// emulator panel; this file never requires the emulator. Names come from
// src/script/names.json and need no emulator.
//
//   soe://ram/index.md              every known address with its live value (live)
//   soe://ram/wram.bin              all of $7E0000-$7FFFFF          (live)
//   soe://ram/<addr>[<len>].bin     slice, addr $0-$1FFFF or $7Exxxx (live, unlisted)
//   soe://ram/<addr>.json           value at addr, read at its known size; a flag byte
//                                   lists its bits (live; known addresses are listed)
//   soe://ram/<addr>.<bit>.json     one flag bit and its name       (live, unlisted)
//   soe://ram/flags.json            every flag byte, its bits set or not (live)
//   soe://ram/status.json           emulator open/running, ROM, paused (live, no game needed)
//   soe://ram/symbols.json          every known address (size, type, name, tags) and flag byte
// Known addresses: ram-symbols.js (names.json + soe://tags/ WRAM links).

const { parseAddressName, hexId } = require('../shared/resource-uri');
const NAMES = require('../script/names.json');
const { dir, file, json, text } = require('./nodes');
const { ramSymbols, ramSymbol, ramBlocks } = require('./ram-symbols');
const { tagModel } = require('./tag-model');
const { pageUri } = require('./tag-markdown');

const WRAM = 0x7E0000;
const WRAM_SIZE = 0x20000;
const DEFAULT_SLICE = 0x100;

/** names.json labels end in their own address: `PRIZE ($2391)` → `PRIZE`. */
const label = s => String(s).replace(/\s*\(\$[0-9a-f]+\)\s*$/i, '');
const addrName = a => (NAMES.ram[String(a)] !== undefined ? label(NAMES.ram[String(a)]) : null);
const flagName = (a, bit) => NAMES.flags[`${a}:${bit}`] ?? null;

/**
 * @param {(bus: number, len: number) => Promise<Uint8Array>} readMemory
 * @param {() => Promise<object>} status
 */
function resolveRam(segments, readMemory, status) {
    if (segments.length > 1) return null;
    const [name] = segments;
    if (name === undefined) {
        return dir([['index.md', 'file'], ['status.json', 'file'], ['wram.bin', 'file'], ['flags.json', 'file'], ['symbols.json', 'file'],
            ...listed().map(e => [hexId(e.addr, 4) + '.json', 'file'])]);
    }
    if (name === 'index.md') return text(() => indexMarkdown(readMemory), true);
    if (name === 'status.json') return json(status, true);
    if (name === 'symbols.json') return json(symbols);
    if (name === 'wram.bin') return file(() => readMemory(WRAM, WRAM_SIZE).then(Buffer.from), true);
    if (name === 'flags.json') return json(() => flags(readMemory), true);

    const a = parseAddressName(name);
    if (!a) return null;
    const off = a.addr >= WRAM ? a.addr - WRAM : a.addr;
    if (off < 0 || off >= WRAM_SIZE) return null;
    if (a.ext === 'bin') {
        if (a.bit !== null) return null;
        const len = a.len ?? DEFAULT_SLICE;
        if (off + len > WRAM_SIZE) return null;
        return file(() => readMemory(WRAM + off, len).then(Buffer.from), true);
    }
    if (a.len !== null) return null;
    if (a.bit !== null) return json(() => readBit(readMemory, off, a.bit), true);
    return json(() => readValue(readMemory, off), true);
}

/** Known single values (not flag bytes or blocks): listed in the directory and the index. */
const listed = () => ramSymbols().filter(e => e.type !== 'flags');

const le = (b, n) => { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + (b[i] ?? 0); return v; };

/** One address: read at its known size (word if unknown); a flag byte also lists its bits. */
async function readValue(readMemory, off) {
    const sym = ramSymbol(off);
    const size = Math.min(sym ? sym.size : 2, WRAM_SIZE - off);
    const b = await readMemory(WRAM + off, Math.max(size, Math.min(2, WRAM_SIZE - off)));
    return describeValue(off, sym, b, size);
}

function describeValue(off, sym, b, size) {
    const word = b.length > 1 ? b[0] | (b[1] << 8) : null;
    const value = le(b, size);
    const out = {
        address: '$' + hexId(off, 4),
        bus: '$' + hexId(WRAM + off, 6),
        name: (sym && sym.name) || addrName(off),
        type: sym ? sym.type : 'word',
        size,
        value,
        hex: '$' + hexId(value, size * 2),
        valueName: NAMES.ramValues[String(off)]?.[String(word)] ?? null,
        tags: sym ? sym.tags : [],
        byte: b[0],
        word,
    };
    if (sym && sym.bits) out.bits = Object.entries(sym.bits).map(([bit, n]) => ({ bit: Number(bit), name: n, set: !!(b[0] & (1 << bit)) }));
    return out;
}

async function readBit(readMemory, off, bit) {
    const [byte] = await readMemory(WRAM + off, 1);
    return { flag: `${hexId(off, 4)}.${bit}`, bus: '$' + hexId(WRAM + off, 6), bit, set: !!(byte & (1 << bit)), name: flagName(off, bit) };
}

/** Every flag byte with its named bits; one read spanning the lowest to the highest. */
async function flags(readMemory) {
    const bytes = ramSymbols().filter(e => e.type === 'flags');
    const lo = bytes[0].addr, hi = bytes[bytes.length - 1].addr;
    const mem = await readMemory(WRAM + lo, hi - lo + 1);
    return bytes.map(e => {
        const v = mem[e.addr - lo];
        return {
            address: hexId(e.addr, 4), value: v, hex: '$' + hexId(v, 2), binary: v.toString(2).padStart(8, '0'),
            bits: Object.entries(e.bits).map(([bit, name]) => ({ bit: Number(bit), flag: `${hexId(e.addr, 4)}.${bit}`, name, set: !!(v & (1 << bit)) })),
        };
    });
}

function symbols() {
    const all = ramSymbols();
    return {
        addresses: all.filter(e => e.type !== 'flags').map(e => ({
            address: hexId(e.addr, 4), size: e.size, type: e.type, name: e.name, tags: e.tags.length ? e.tags : undefined, values: e.values,
        })),
        flags: all.filter(e => e.type === 'flags').map(e => ({ address: hexId(e.addr, 4), size: 1, type: 'flags', bits: e.bits })),
        blocks: ramBlocks().map(b => ({ address: hexId(b.addr, 4), size: b.size, file: `${hexId(b.addr, 4)}[${b.size.toString(16)}].bin`, tags: b.tags })),
    };
}

const tagLink = id => `[${id}](${pageUri(tagModel(), id)})`;

/** The table of known addresses, with live values when a game runs (one read over their span). */
async function indexMarkdown(readMemory) {
    const rows = listed();
    let mem = null, why = null;
    const lo = rows[0].addr, hi = rows[rows.length - 1].addr + 4;
    try { mem = await readMemory(WRAM + lo, Math.min(hi, WRAM_SIZE) - lo); } catch (err) { why = err && err.message || String(err); }
    const cell = s => String(s ?? '').replace(/\|/g, '\\|');
    const table = rows.map(e => {
        const v = mem ? describeValue(e.addr, e, mem.subarray(e.addr - lo, e.addr - lo + Math.max(e.size, 2)), e.size) : null;
        const tags = e.tags.map(tagLink).join(', ');
        return `| [${hexId(e.addr, 4)}](${hexId(e.addr, 4)}.json) | ${e.type} | ${cell(e.name)} | ${v ? `${v.value} (${v.hex})${v.valueName ? ' ' + cell(v.valueName) : ''}` : ''} | ${tags} |`;
    });
    return `# soe://ram/

The running emulator's WRAM (\`$7E0000-$7FFFFF\`). Every file except
[status.json](status.json), [symbols.json](symbols.json) and this page's list
needs a game running in the Everscript emulator; open files refresh about once
a second. Bus addresses work too: [soe://bus/7e0adb](soe://bus/7e0adb) links to
[0adb.json](0adb.json). Concepts that use these addresses: [soe://tags/](soe://tags/index.md).

| Path | Content |
|---|---|
| [status.json](status.json) | emulator closed / open / running, its ROM, paused |
| [wram.bin](wram.bin) | all 128 KB |
| \`<addr>[<len>].bin\` | slice, hex, e.g. [2222[2].bin](2222%5B2%5D.bin) or [7e1000[40].bin](7e1000%5B40%5D.bin) |
| \`<addr>.json\` | value at its known size, name, tags; a flag byte lists its bits, e.g. [0adb.json](0adb.json) (current room) |
| \`<addr>.<bit>.json\` | one flag, e.g. [2258.0.json](2258.0.json) (Acid Rain known) |
| [flags.json](flags.json) | every flag byte and its named bits, set or not |
| [symbols.json](symbols.json) | every known address (size, type, name, tags) and flag byte |

## Known addresses (${rows.length})

${mem ? '' : `Live values unavailable (${cell(why)}); start a game in the Everscript emulator.\n\n`}| Address | Type | Name | Value | Tags |
|---|---|---|---|---|
${table.join('\n')}

## Records (${ramBlocks().length})

| Range | Size | Tags |
|---|---|---|
${ramBlocks().map(b => `| [${hexId(b.addr, 4)}-${hexId(b.addr + b.size - 1, 4)}](${hexId(b.addr, 4)}%5B${b.size.toString(16)}%5D.bin) | ${b.size} bytes | ${b.tags.map(tagLink).join(', ')} |`).join('\n')}

Flag bytes (${ramSymbols().filter(e => e.type === 'flags').length}, with their bits): [flags.json](flags.json).
`;
}

module.exports = { resolveRam };
