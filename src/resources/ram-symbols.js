'use strict';
// Ownership: every WRAM address the plugin knows, in one list — the named
// addresses of src/script/names.json, the WRAM links of `soe://tags/`, and the
// flag bytes (one entry per byte, bits named). Pure: no emulator.
//
//   ramSymbols(): { addr, size, type, name, tags, values?, bits? }
//                 type: 'byte' | 'word' | 'long' | 'dword' | 'flags'
//   ramBlocks():  { addr, size, tags } — records longer than 4 bytes (entity, stats block)

const NAMES = require('../script/names.json');
const { tagModel } = require('./tag-model');

const TYPE = { 1: 'byte', 2: 'word', 3: 'long', 4: 'dword' };
const WRAM = 0x7E0000;

/** names.json labels end in their own address: `PRIZE ($2391)` → `PRIZE`. */
const label = s => String(s).replace(/\s*\(\$[0-9a-f]+\)\s*$/i, '');

/** `soe://ram/4eb3.json` → { addr, len }; `0a49[4].bin` → len 4; flag bits and other authorities → null. */
function ramTarget(uri) {
    const m = /^soe:\/\/ram\/([0-9a-f]{1,6})(?:\[([0-9a-f]{1,5})\])?\.(json|bin)$/i.exec(uri);
    if (!m) return null;
    const addr = parseInt(m[1], 16);
    return { addr: addr >= WRAM ? addr - WRAM : addr, len: m[2] ? parseInt(m[2], 16) : null };
}

let _cache = null, _blocks = null;

/** Every known WRAM address, sorted; flag bytes included. */
function ramSymbols() {
    if (_cache) return _cache;
    const byAddr = new Map();
    const entry = addr => {
        if (!byAddr.has(addr)) byAddr.set(addr, { addr, size: null, type: null, name: null, tags: [] });
        return byAddr.get(addr);
    };
    for (const [a, name] of Object.entries(NAMES.ram)) {
        const e = entry(Number(a));
        e.name = label(name);
        if (NAMES.ramValues[a]) e.values = NAMES.ramValues[a];
    }
    for (const [k, name] of Object.entries(NAMES.flags)) {
        const [a, bit] = k.split(':').map(Number);
        const e = entry(a);
        e.type = 'flags';
        e.size = 1;
        (e.bits = e.bits || {})[bit] = name;
    }
    const model = tagModel();
    const blocks = new Map();
    for (const t of model.tags.values()) {
        for (const l of t.links) {
            const r = ramTarget(l.uri);
            if (!r) continue;
            if (r.len > 4) {
                const key = `${r.addr}:${r.len}`;
                if (!blocks.has(key)) blocks.set(key, { addr: r.addr, size: r.len, tags: [] });
                blocks.get(key).tags.push(t.id);
                continue;
            }
            const e = entry(r.addr);
            if (!e.tags.includes(t.id)) e.tags.push(t.id);
            if (e.type === 'flags') continue;
            const size = r.len ?? t.size ?? null;
            if (size && !e.size) e.size = size;
            if (!e.name) e.name = model.title(t.id) || t.id;
        }
    }
    for (const e of byAddr.values()) {
        if (!e.size) e.size = 2;                    // names.json addresses are read as words
        if (!e.type) e.type = TYPE[e.size];
    }
    _cache = [...byAddr.values()].sort((x, y) => x.addr - y.addr);
    _blocks = [...blocks.values()].sort((x, y) => x.addr - y.addr);
    return _cache;
}

/** Records longer than 4 bytes that tags link as `<addr>[<len>].bin`. */
function ramBlocks() {
    ramSymbols();
    return _blocks;
}

/** The known entry at a WRAM offset, or null. */
function ramSymbol(addr) {
    return ramSymbols().find(e => e.addr === addr) || null;
}

module.exports = { ramSymbols, ramSymbol, ramBlocks };
