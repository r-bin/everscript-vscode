'use strict';
// Ownership: `soe://ram/` — the running emulator's 128 KB WRAM as files.
// Values come from `readMemory(busAddr, len)`, which extension.js wires to the
// emulator panel; this file never requires the emulator. Names come from
// src/script/names.json and need no emulator.
//
//   soe://ram/index.md              what is here
//   soe://ram/wram.bin              all of $7E0000-$7FFFFF          (live)
//   soe://ram/<addr>[<len>].bin     slice, addr $0-$1FFFF or $7Exxxx (live, unlisted)
//   soe://ram/<addr>.json           byte, word and name at addr     (live, unlisted)
//   soe://ram/<addr>.<bit>.json     one flag bit and its name       (live, unlisted)
//   soe://ram/flags.json            every named flag, set or not    (live)
//   soe://ram/status.json           emulator open/running, ROM, paused (live, no game needed)
//   soe://ram/symbols.json          every named address and flag

const { parseAddressName, hexId } = require('../shared/resource-uri');
const NAMES = require('../script/names.json');
const { dir, file, json, text } = require('./nodes');

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
        return dir([['index.md', 'file'], ['status.json', 'file'], ['wram.bin', 'file'], ['flags.json', 'file'], ['symbols.json', 'file']]);
    }
    if (name === 'index.md') return text(indexMarkdown);
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

async function readValue(readMemory, off) {
    const b = await readMemory(WRAM + off, off + 1 < WRAM_SIZE ? 2 : 1);
    const word = b.length > 1 ? b[0] | (b[1] << 8) : null;
    const valueName = word === null ? null : NAMES.ramValues[String(off)]?.[String(word)] ?? null;
    return {
        address: '$' + hexId(off, 4),
        bus: '$' + hexId(WRAM + off, 6),
        name: addrName(off),
        byte: b[0],
        word,
        hex: '$' + hexId(word ?? b[0], word === null ? 2 : 4),
        valueName,
    };
}

async function readBit(readMemory, off, bit) {
    const [byte] = await readMemory(WRAM + off, 1);
    return { flag: `${hexId(off, 4)}.${bit}`, bus: '$' + hexId(WRAM + off, 6), bit, set: !!(byte & (1 << bit)), name: flagName(off, bit) };
}

/** Every named flag; one read spanning the lowest to the highest flag byte. */
async function flags(readMemory) {
    const keys = Object.keys(NAMES.flags).map(k => k.split(':').map(Number));
    const lo = Math.min(...keys.map(k => k[0])), hi = Math.max(...keys.map(k => k[0]));
    const bytes = await readMemory(WRAM + lo, hi - lo + 1);
    return keys.sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(([a, bit]) => ({
        flag: `${hexId(a, 4)}.${bit}`, set: !!(bytes[a - lo] & (1 << bit)), name: NAMES.flags[`${a}:${bit}`],
    }));
}

function symbols() {
    return {
        addresses: Object.keys(NAMES.ram).map(Number).sort((a, b) => a - b)
            .map(a => ({ address: hexId(a, 4), name: addrName(a), values: NAMES.ramValues[String(a)] ?? undefined })),
        flags: Object.keys(NAMES.flags).map(k => k.split(':').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1])
            .map(([a, bit]) => ({ flag: `${hexId(a, 4)}.${bit}`, name: NAMES.flags[`${a}:${bit}`] })),
    };
}

function indexMarkdown() {
    return `# soe://ram/

The running emulator's WRAM (\`$7E0000-$7FFFFF\`). Every file except
[status.json](status.json), [symbols.json](symbols.json) and this page needs
a game running in the Everscript emulator; open files refresh about once a
second. Bus addresses work too: [soe://bus/7e0adb](soe://bus/7e0adb) links to
[0adb.json](0adb.json).

| Path | Content |
|---|---|
| [status.json](status.json) | emulator closed / open / running, its ROM, paused |
| [wram.bin](wram.bin) | all 128 KB |
| \`<addr>[<len>].bin\` | slice, hex, e.g. [2222[2].bin](2222%5B2%5D.bin) or [7e1000[40].bin](7e1000%5B40%5D.bin) |
| \`<addr>.json\` | byte, word and name, e.g. [0adb.json](0adb.json) (current room) |
| \`<addr>.<bit>.json\` | one flag, e.g. [2258.0.json](2258.0.json) (Acid Rain known) |
| [flags.json](flags.json) | every named flag and whether it is set |
| [symbols.json](symbols.json) | every named address and flag |
`;
}

module.exports = { resolveRam };
